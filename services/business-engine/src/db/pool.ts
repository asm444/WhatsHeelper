import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://amaral:amaral_secret_2024@localhost:5432/amaral_suport',
});

export default pool;
