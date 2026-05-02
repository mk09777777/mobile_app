/**
 * Script to create a client user with role 4
 * 
 * Usage:
 *   node create-client-user.js
 * 
 * This script creates a user with:
 *   - Email: test@cl.com
 *   - Password: 123456
 *   - Role: 4 (client)
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function createClientUser() {
  try {
    console.log('Creating client user...');
    console.log('Email: test@cl.com');
    console.log('Password: 123456');
    console.log('Role: 4 (client)');
    console.log('API URL:', BASE_URL);
    console.log('');

    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@cl.com',
        password: '123456',
        roleNumber: 4,
        name: 'Test Client',
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ User created successfully!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Failed to create user');
      console.error('Error:', data.error || data.message || 'Unknown error');
      console.error('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    console.error('Make sure your backend server is running on', BASE_URL);
  }
}

// Run the script
createClientUser();


