const axios = require('axios').default;

// const PROVIDER = 'tiktok'; //idk if this is correct...pretty sure it is
const PROVIDER = 'oauth_google'; 

module.exports = {
    uploadVideo
}

async function uploadVideo(req, res) {
    const userId = req.params.userId;

    const accessToken = await getAccessToken(userId);

    res.send(accessToken);
}

async function getAccessToken(userId) {
    const endpoint = `https://api.clerk.dev/v1/users/${userId}/oauth_access_tokens/${PROVIDER}` //injection risk?

     
    // const endpoint = `https://api.clerk.dev/v1/users/user_2Bs2a7O8IswylxJXK6nXVwUEUYz`//for fetching a user by id
    
    try {
        const response = await axios({
            method: "GET",
            url: endpoint,
            headers: {
                "Authorization": `Bearer ${process.env.CLERK_API_KEY}`,
                "Content-type": "application/json"
            }

        });
        console.log('\n\n\n', response.data[0].token, '\n\n\n');

        return response.data[0].token;

    } catch (error) {
        console.log(error);
        return error;
    }

}