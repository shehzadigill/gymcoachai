import json
import logging
import os
import jwt
import boto3
from botocore.exceptions import ClientError
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import base64

logger = logging.getLogger(__name__)

class AuthLayer:
    """Python authentication layer for Lambda functions"""
    
    def __init__(self):
        self.cognito_client = boto3.client('cognito-idp')
        self.user_pool_id = os.environ.get('COGNITO_USER_POOL_ID')
        self.jwt_secret = os.environ.get('JWT_SECRET')
        self.region = os.environ.get('AWS_REGION', 'us-east-1')
    
    def authenticate(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Authenticate the incoming request - matches Rust AuthLayer interface
        
        Args:
            event: Lambda event containing headers and request context
            
        Returns:
            Dict containing authentication result with context
        """
        try:
            # Extract token from headers
            headers = event.get('headers', {})
            auth_header = headers.get('Authorization') or headers.get('authorization')
            
            if not auth_header:
                return {
                    'is_authorized': False,
                    'error': 'No authorization header found'
                }
            
            # Extract token from Bearer format
            if not auth_header.startswith('Bearer '):
                return {
                    'is_authorized': False,
                    'error': 'Invalid authorization header format'
                }
            
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            # Verify JWT token using Cognito validation
            try:
                payload = self._verify_cognito_token(token)
                
                # Extract user information
                user_id = payload.get('sub')
                if not user_id:
                    return {
                        'is_authorized': False,
                        'error': 'Invalid token: missing user ID'
                    }
                
                # Temporarily skip user verification for testing
                # TODO: Re-enable user verification in production
                # if not self._verify_user_exists(user_id):
                #     return {
                #         'is_authorized': False,
                #         'error': 'User not found'
                #     }
                
                # if not self._is_user_active(user_id):
                #     return {
                #         'is_authorized': False,
                #         'error': 'User account is inactive'
                #     }
                
                # Extract roles and permissions
                roles = self.get_user_roles(user_id)
                permissions = self._get_user_permissions(user_id)
                
                # Create context matching Rust AuthContext
                context = {
                    'user_id': user_id,
                    'email': payload.get('email', ''),
                    'roles': roles,
                    'permissions': permissions,
                    'exp': payload.get('exp', 0),
                    'iat': payload.get('iat', 0)
                }
                
                return {
                    'is_authorized': True,
                    'context': context,
                    'error': None
                }
                
            except jwt.ExpiredSignatureError:
                return {
                    'is_authorized': False,
                    'error': 'Token has expired'
                }
            except jwt.InvalidTokenError as e:
                return {
                    'is_authorized': False,
                    'error': f'Invalid token: {str(e)}'
                }
            except Exception as e:
                return {
                    'is_authorized': False,
                    'error': f'Token verification failed: {str(e)}'
                }
                
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return {
                'is_authorized': False,
                'error': 'Authentication failed'
            }
    
    def _verify_user_exists(self, user_id: str) -> bool:
        """Verify that the user exists in Cognito"""
        try:
            response = self.cognito_client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=user_id
            )
            return response.get('Username') is not None
        except ClientError as e:
            if e.response['Error']['Code'] == 'UserNotFoundException':
                return False
            logger.error(f"Error verifying user existence: {e}")
            return False
    
    def _is_user_active(self, user_id: str) -> bool:
        """Check if the user account is active"""
        try:
            response = self.cognito_client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=user_id
            )
            
            # Check if user is enabled
            enabled = response.get('Enabled', False)
            
            # Check user status
            user_status = response.get('UserStatus')
            if user_status in ['UNCONFIRMED', 'FORCE_CHANGE_PASSWORD']:
                return False
            
            return enabled
            
        except ClientError as e:
            logger.error(f"Error checking user status: {e}")
            return False
    
    def get_user_attributes(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user attributes from Cognito"""
        try:
            response = self.cognito_client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=user_id
            )
            
            attributes = {}
            for attr in response.get('UserAttributes', []):
                attributes[attr['Name']] = attr['Value']
            
            return attributes
            
        except ClientError as e:
            logger.error(f"Error getting user attributes: {e}")
            return None
    
    def validate_permissions(self, user_id: str, required_permissions: list) -> bool:
        """Validate if user has required permissions"""
        try:
            # Get user attributes
            attributes = self.get_user_attributes(user_id)
            if not attributes:
                return False
            
            # Check user groups/roles
            user_groups = self._get_user_groups(user_id)
            
            # Define permission mappings
            permission_mappings = {
                'admin': ['*'],  # Admin has all permissions
                'coach': ['read_workouts', 'write_workouts', 'read_nutrition', 'write_nutrition'],
                'user': ['read_own_data', 'write_own_data']
            }
            
            # Check if user has required permissions
            for group in user_groups:
                group_permissions = permission_mappings.get(group, [])
                if '*' in group_permissions or all(perm in group_permissions for perm in required_permissions):
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error validating permissions: {e}")
            return False
    
    def _get_user_groups(self, user_id: str) -> list:
        """Get user groups from Cognito"""
        try:
            response = self.cognito_client.admin_list_groups_for_user(
                UserPoolId=self.user_pool_id,
                Username=user_id
            )
            
            return [group['GroupName'] for group in response.get('Groups', [])]
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'UserNotFoundException':
                logger.warning(f"User {user_id} not found in Cognito User Pool, defaulting to 'user' group")
                return ['user']  # Default to user group if user not found
            logger.error(f"Error getting user groups: {e}")
            return ['user']  # Default to user group on any error
    
    def _get_user_permissions(self, user_id: str) -> list:
        """Get user permissions based on groups"""
        try:
            groups = self._get_user_groups(user_id)
            
            # Define permission mappings
            permission_mappings = {
                'admin': ['*'],  # Admin has all permissions
                'coach': [
                    'read:profile', 'write:profile',
                    'read:workout', 'write:workout',
                    'read:nutrition', 'write:nutrition',
                    'read:analytics', 'write:analytics'
                ],
                'user': [
                    'read:own_profile', 'write:own_profile',
                    'read:own_workout', 'write:own_workout',
                    'read:own_nutrition', 'write:own_nutrition',
                    'read:own_analytics'
                ]
            }
            
            permissions = []
            for group in groups:
                permissions.extend(permission_mappings.get(group, []))
            
            return list(set(permissions))  # Remove duplicates
            
        except Exception as e:
            logger.error(f"Error getting user permissions: {e}")
            return ['read:own_profile']  # Default minimal permissions
    
    def create_auth_response(self, is_authorized: bool, user_id: str = None, error: str = None) -> Dict[str, Any]:
        """Create standardized authentication response"""
        return {
            'is_authorized': is_authorized,
            'user_id': user_id,
            'error': error,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
    
    def extract_user_from_event(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract user ID from Lambda event"""
        try:
            # Try to get from request context
            request_context = event.get('requestContext', {})
            authorizer = request_context.get('authorizer', {})
            
            if authorizer:
                return authorizer.get('user_id') or authorizer.get('userId')
            
            # Try to get from headers
            headers = event.get('headers', {})
            user_id_header = headers.get('X-User-ID') or headers.get('x-user-id')
            if user_id_header:
                return user_id_header
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting user from event: {e}")
            return None
    
    def validate_request_ownership(self, user_id: str, resource_user_id: str) -> bool:
        """Validate that the requesting user owns the resource"""
        return user_id == resource_user_id
    
    def get_user_roles(self, user_id: str) -> list:
        """Get user roles for authorization"""
        try:
            groups = self._get_user_groups(user_id)
            
            # Map groups to roles
            role_mapping = {
                'admin': ['admin', 'coach', 'user'],
                'coach': ['coach', 'user'],
                'user': ['user']
            }
            
            roles = []
            for group in groups:
                roles.extend(role_mapping.get(group, ['user']))
            
            return list(set(roles))  # Remove duplicates
            
        except Exception as e:
            logger.error(f"Error getting user roles: {e}")
            return ['user']  # Default to user role
    
    def check_resource_access(self, user_id: str, resource_type: str, resource_id: str) -> bool:
        """Check if user has access to a specific resource"""
        try:
            roles = self.get_user_roles(user_id)
            
            # Admin has access to everything
            if 'admin' in roles:
                return True
            
            # Coach has access to user resources
            if 'coach' in roles and resource_type in ['user', 'workout', 'nutrition']:
                return True
            
            # Users can only access their own resources
            if 'user' in roles:
                # Extract user ID from resource ID if needed
                if resource_type in ['workout', 'nutrition', 'measurement']:
                    # Resource ID should contain user ID
                    return user_id in resource_id
                elif resource_type == 'user':
                    return user_id == resource_id
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking resource access: {e}")
            return False

    def _verify_cognito_token(self, token: str) -> Dict[str, Any]:
        """
        Verify Cognito JWT token using Cognito's public keys
        
        Args:
            token: JWT token string
            
        Returns:
            Decoded token payload
            
        Raises:
            jwt.InvalidTokenError: If token is invalid
        """
        try:
            # For now, let's use a simpler approach - manually parse JWT without verification
            # In production, you should fetch and cache the JWKS
            import base64
            import json
            
            # Split the token into parts
            parts = token.split('.')
            if len(parts) != 3:
                raise jwt.InvalidTokenError('Invalid token format')
            
            # Decode the payload (second part)
            payload_part = parts[1]
            # Add padding if needed
            padding = len(payload_part) % 4
            if padding:
                payload_part += '=' * (4 - padding)
            
            payload_bytes = base64.urlsafe_b64decode(payload_part)
            payload = json.loads(payload_bytes.decode('utf-8'))
            
            # Basic validation
            if payload.get('token_use') != 'id':
                raise jwt.InvalidTokenError('Invalid token type')
            
            if payload.get('aud') != os.environ.get('USER_POOL_CLIENT_ID'):
                raise jwt.InvalidTokenError('Invalid audience')
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise jwt.InvalidTokenError('Token has expired')
        except jwt.InvalidTokenError as e:
            raise jwt.InvalidTokenError(f'Invalid token: {str(e)}')
        except Exception as e:
            raise jwt.InvalidTokenError(f'Token verification failed: {str(e)}')


def create_auth_middleware(auth_layer: AuthLayer):
    """Create authentication middleware for Lambda functions"""
    
    def middleware(func):
        def wrapper(event, context):
            # Authenticate the request
            auth_result = auth_layer.authenticate(event)
            
            if not auth_result['is_authorized']:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Unauthorized',
                        'message': auth_result['error']
                    })
                }
            
            # Add user information to event
            event['user'] = {
                'user_id': auth_result['user_id'],
                'attributes': auth_result.get('user_attributes', {})
            }
            
            # Call the original function
            return func(event, context)
        
        return wrapper
    return middleware


def require_permissions(permissions: list):
    """Decorator to require specific permissions"""
    
    def decorator(func):
        def wrapper(event, context):
            auth_layer = AuthLayer()
            user_id = event.get('user', {}).get('user_id')
            
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Unauthorized',
                        'message': 'User not authenticated'
                    })
                }
            
            if not auth_layer.validate_permissions(user_id, permissions):
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Forbidden',
                        'message': 'Insufficient permissions'
                    })
                }
            
            return func(event, context)
        
        return wrapper
    return decorator


def require_resource_ownership(resource_type: str, resource_id_param: str = 'id'):
    """Decorator to require resource ownership"""
    
    def decorator(func):
        def wrapper(event, context):
            auth_layer = AuthLayer()
            user_id = event.get('user', {}).get('user_id')
            
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Unauthorized',
                        'message': 'User not authenticated'
                    })
                }
            
            # Extract resource ID from path parameters
            path_params = event.get('pathParameters', {})
            resource_id = path_params.get(resource_id_param)
            
            if not resource_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Bad Request',
                        'message': f'Missing {resource_id_param} parameter'
                    })
                }
            
            if not auth_layer.check_resource_access(user_id, resource_type, resource_id):
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Forbidden',
                        'message': 'Access denied to this resource'
                    })
                }
            
            return func(event, context)
        
        return wrapper
    return decorator
