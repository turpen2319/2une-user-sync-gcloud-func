const axios = require('axios').default;
const FormData = require('form-data');
const fs = require('fs/promises');

const PROVIDER = 'oauth_tiktok';
 

module.exports = {
    uploadVideo,
    getAccessToken,
    getTikTokUploadParams
}

async function uploadVideo(req, res) {
    console.log("\n\nMY DATA ----> ", req.body, "-----------------")

    const userId = req.params.userId; 
    const accessToken = await getAccessToken(userId);
    const openId = await getTikTokOpenId(userId);
    console.log({accessToken, openId})

    const endpoint = `https://open-api.tiktok.com/share/video/upload/?access_token=${accessToken}&open_id=${openId}`

    const video = await fs.readFile(process.env.HOME + '/Desktop/test1.mp4');
    const form = new FormData();
    form.append('video', video, 'test1.mp4');

    try {
        const uploadResponse = await axios.post(endpoint, form, {
            headers: {
              ...form.getHeaders(),
            },
            maxContentLength: 100000000,
            maxBodyLength: 100000000
        });
        console.log("upload ---> \n\n", uploadResponse.data);
    
        res.send(uploadResponse.data);
        
    } catch (error) {
        console.log(error);
        res.send(error)
    }
    
}

//this will fail if user hasn't logged in...fine in production flow, but 
//make sure to log in the user you're testing with before uploading on their behalf
async function getAccessToken(userId) {
    const endpoint = `https://api.clerk.dev/v1/users/${userId}/oauth_access_tokens/${PROVIDER}` //injection risk?
    
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
        return error;
    }

}


async function getTikTokOpenId(userId) {
    const endpoint = `https://api.clerk.dev/v1/users/${userId}`//for fetching a user by id
    
    try {
        const response = await axios({
            method: "GET",
            url: endpoint,
            headers: {
                "Authorization": `Bearer ${process.env.CLERK_API_KEY}`,
                "Content-type": "application/json"
            }
        });

        const clerkUserObj = response.data;
        const userTikTokOpenId = clerkUserObj.external_accounts[0].provider_user_id; //this will need to change if we allow users to connect to other external accounts
        
        return userTikTokOpenId;

    } catch (error) {
        return error;
    }
}

async function getTikTokUploadParams(req, res) {
    const { userId } = req.params;
    try {
        const params = {
            openId: await getTikTokOpenId(userId),
            accessToken: await getAccessToken(userId)
        }
    
        console.log(params);
    
        res.json(params);
        
    } catch (error) {
        res.status(400).json(error);
    }
}