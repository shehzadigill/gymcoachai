use anyhow::Result;

use crate::repository::WaterRepository;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct WaterService {
    water_repository: WaterRepository,
}

impl WaterService {
    pub fn new(water_repository: WaterRepository) -> Self {
        Self { water_repository }
    }

    pub async fn get_water(&self, user_id: &str, date: &str, auth_context: &AuthContext) -> Result<Option<u32>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own water intake data"));
        }

        self.water_repository.get_water_by_date(user_id, date).await
    }

    pub async fn set_water(&self, user_id: &str, date: &str, glasses: u32, auth_context: &AuthContext) -> Result<()> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only update your own water intake data"));
        }

        self.water_repository.set_water_by_date(user_id, date, glasses).await
    }
}
