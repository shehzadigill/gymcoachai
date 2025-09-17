'use client';

import { Button, Card, Badge } from '../../../../packages/ui/dist';
import { useCurrentUser, signOut } from '../../../../packages/auth/dist';
import Link from 'next/link';

export default function Home() {
  const { isAuthenticated, isLoading, name } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <div className="flex justify-between items-center mb-8">
            <div></div>
            <div className="flex gap-4">
              {isAuthenticated ? (
                <>
                  <span className="text-secondary-600">
                    Welcome, {name || 'User'}!
                  </span>
                  <Button variant="outline" onClick={() => signOut()}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button variant="outline">Sign In</Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button variant="primary">Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <h1 className="text-5xl font-bold text-secondary-900 mb-4">
            GymCoach AI
          </h1>
          <p className="text-xl text-secondary-600 mb-8">
            Your intelligent fitness companion powered by AI
          </p>
          <div className="flex gap-4 justify-center">
            <Badge variant="success">AI-Powered</Badge>
            <Badge variant="info">Personalized</Badge>
            <Badge variant="warning">Real-time</Badge>
          </div>
        </header>

        <main className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <h2 className="text-2xl font-semibold text-secondary-900 mb-4">
              Smart Workouts
            </h2>
            <p className="text-secondary-600 mb-6">
              Get personalized workout plans tailored to your fitness level and
              goals.
            </p>
            {isAuthenticated ? (
              <Button variant="primary" size="lg">
                Start Workout
              </Button>
            ) : (
              <Link href="/auth/signup">
                <Button variant="primary" size="lg">
                  Sign Up to Start
                </Button>
              </Link>
            )}
          </Card>

          <Card className="text-center">
            <h2 className="text-2xl font-semibold text-secondary-900 mb-4">
              Nutrition Tracking
            </h2>
            <p className="text-secondary-600 mb-6">
              Track your meals and get AI-powered nutrition recommendations.
            </p>
            {isAuthenticated ? (
              <Button variant="secondary" size="lg">
                Track Nutrition
              </Button>
            ) : (
              <Link href="/auth/signup">
                <Button variant="secondary" size="lg">
                  Sign Up to Track
                </Button>
              </Link>
            )}
          </Card>

          <Card className="text-center">
            <h2 className="text-2xl font-semibold text-secondary-900 mb-4">
              Progress Analytics
            </h2>
            <p className="text-secondary-600 mb-6">
              Monitor your progress with detailed analytics and insights.
            </p>
            {isAuthenticated ? (
              <Button variant="outline" size="lg">
                View Progress
              </Button>
            ) : (
              <Link href="/auth/signup">
                <Button variant="outline" size="lg">
                  Sign Up to View
                </Button>
              </Link>
            )}
          </Card>
        </main>

        <footer className="text-center text-secondary-500">
          <p>Built with Next.js, React Native, and AWS Lambda</p>
        </footer>
      </div>
    </div>
  );
}
