const axios = require('axios');

async function testSubmission() {
  const payload = {
    fname: 'Test',
    lname: 'User',
    phone: '5551234567',
    state: 'CA',
    age: '50',
    beneficiary: 'spouse',
    xxTrustedFormCertUrl: 'https://cert.trustedform.com/test',
    case_type: 'Final Expense',
    ownerid: '005TR00000CDuezYAD'
  };

  try {
    console.log('Sending submission...');
    const response = await axios.post('http://localhost:5000/api-proxy/', [payload], {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from("Over.The.World.Sales:STD8 7CNS URtl fHof uH3f 3VZJ").toString('base64')
      }
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

    if (response.status === 200 && response.data.status === 'SUCCESS') {
      console.log('✅ Submission successful');
    } else {
      console.error('❌ Submission failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testSubmission();
