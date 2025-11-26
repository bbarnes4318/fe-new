const axios = require('axios');

async function testFetching() {
  try {
    console.log('Fetching submissions...');
    // We need a valid token to fetch submissions. 
    // Since we can't easily login via script without a known user/pass, 
    // we might need to temporarily bypass auth or use a known test user.
    // For now, let's try to hit the endpoint and see if we get a 401 (which means the route exists) 
    // or a 404 (route missing) or 500 (server error).
    
    // Actually, let's try to login first if we can.
    // Assuming 'admin' / 'admin123' or similar might exist, but I don't have credentials.
    // I'll just hit the endpoint without auth to check connectivity first.
    
    const response = await axios.get('http://localhost:5000/api/submissions', {
      validateStatus: function (status) {
        return status < 600; // Resolve even if 401/500
      }
    });

    console.log('Response status:', response.status);
    if (response.status === 401 || response.status === 403) {
        console.log('✅ Endpoint is reachable (Auth required, which is expected).');
    } else if (response.status === 200) {
        console.log('✅ Endpoint is reachable and returned data.');
        console.log('Data count:', response.data.submissions ? response.data.submissions.length : 'Unknown');
    } else {
        console.log('❌ Endpoint returned unexpected status:', response.status);
        console.log('Response data:', response.data);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testFetching();
