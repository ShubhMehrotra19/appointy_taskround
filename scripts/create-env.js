// Simple script to create .env file if it doesn't exist
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  fs.writeFileSync(envPath, envContent);
  console.log('.env file created from .env.example');
  console.log('Please update the values in .env file, especially:');
  console.log('- JWT_SECRET (use a random secure string)');
  console.log('- OPENAI_API_KEY (your OpenAI API key)');
} else if (fs.existsSync(envPath)) {
  console.log('.env file already exists');
} else {
  console.log('Creating default .env file...');
  const defaultEnv = `DATABASE_PATH=./synapse.db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
OPENAI_API_KEY=your-openai-api-key-here
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000
`;
  fs.writeFileSync(envPath, defaultEnv);
  console.log('.env file created with default values');
  console.log('Please update the values in .env file, especially:');
  console.log('- JWT_SECRET (use a random secure string)');
  console.log('- OPENAI_API_KEY (your OpenAI API key)');
}

