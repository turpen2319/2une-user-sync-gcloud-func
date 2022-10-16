const { GraphQLClient, gql } = require('graphql-request');
const { getVideoList } = require('./tiktok');
const axios = require('axios').default;
const endpoint = process.env.GQL_ENDPOINT || 'http://localhost:8080/v1/graphql';

module.exports = {
    inviteUser,
    insertUser,
    updateUser,
    onCreateSession,
    notifyLevelUp,
}


const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
        contentType: 'application/json',
        authorization: 'Bearer MY_TOKEN',
        "x-hasura-admin-secret": process.env.ADMIN_SECRET
    },
})

async function inviteUser(req, res) {
    const { phoneNumber } = req.body;
    try {
        console.log(req.body)
        const allowListResponse = await addPhoneToClerkAllowlist(phoneNumber);
        const sendInviteResponse = await sendClerkInvite(phoneNumber);
        res.status(200).json({...allowListResponse, ...sendInviteResponse})
    } catch (error) {
        console.log(error)
        res.json(error)
    }
}

async function addPhoneToClerkAllowlist(phoneNumber) {
    try {
        const response = await axios({
            url: "https://api.clerk.dev/v1/allowlist_identifiers",
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.CLERK_API_KEY}`,
                "Content-type": "application/json"
            },
            data: {
                identifier: phoneNumber,
                notify: false, //this will send sms invite
            }
        })
        console.log("add to allow list resp --> ", response.data)

        return response.data
    } catch (error) {
        console.log(error)
    }
}

async function sendClerkInvite(phoneNumber) {
    try {
        const response = await axios({
            url: "https://api.clerk.dev/v1/invitations",
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.CLERK_API_KEY}`,
                "Content-type": "application/json"
            },
            data: {
                phone_number: phoneNumber,
                public_metadata: {
                    phone_number: phoneNumber,
                    //any fields added here will become part of the clerk user obj once user completes sign up
                }
            }
        })
        return response.data
    } catch (error) {
        console.log(error)
    }
}

async function insertUser(req, res) {
    const { id, email_addresses, first_name, last_name, profile_image_url, phone_numbers } = req.body.data;
    const INSERT_USER_MUTATION = gql`
        mutation ($entry: users_insert_input!) {
            insert_users_one (object: $entry) {
                id
                email
                first_name
                last_name
                tiktok_list
            }
        }
    `
    const variables = {
        entry: {
            id: id,
            email: email_addresses.length ? email_addresses[0].email_address : null,
            first_name: first_name || null,
            last_name: last_name || null,
            profile_image_url: profile_image_url

        }
    }
    
    try {
        const data = await graphQLClient.request(INSERT_USER_MUTATION, variables)
        console.log(JSON.stringify(data, undefined, 2))
        const twilioResponse = await sendTwilioSMS("So you think you stan the 1975? You just joined the game. Congrats.", phone_numbers[0].phone_number)
        // Update tiktok list after user has been inserted because there is no way to 
        // guarentee that the create user webhook will fire before session create webhook.
        // We were running into a case where we were trying to update list only on session created, but the 
        // user had not yet been inserted into our db
        updateTiktokList(id);
        res.send({data, twilioResponse});
    } catch (error) {
        console.log("something went wrong while inserting user --> ", error)
        res.send(error);
    }
}

async function updateUser(req, res) {

    const UPDATE_USER_MUTATION = gql`
        mutation ($user: users_set_input!, $user_id: users_pk_columns_input!){
            update_users_by_pk(_set: $user, pk_columns: $user_id) {
                id
                first_name
                last_name
                email
            }
        } 
    `
    const { id, email_addresses, first_name, display_name } = req.body.data;
    const variables = {
        user: {
          email: email_addresses.length ? email_addresses[0].email_address : null,
          first_name: first_name || null,
          display_name: display_name || null
        },
        user_id: {
          id: id
        }
    }

    const data = await graphQLClient.request(UPDATE_USER_MUTATION, variables);
    console.log(JSON.stringify(data, 'hello', 2));
    res.send(data);
}

async function onCreateSession(req, res) {
    const { user_id } = req.body.data;
    console.log("SESSION CREATED");
    updateTiktokList(user_id)

}

async function updateTiktokList(userId) {
    //want to refresh users tiktoks every session they start --> maybe we can do a chron job for this for high-profile users to ensure they're vid list is always fresh
    const tiktokList = await getVideoList(userId);     

    const UPDATE_USER_MUTATION = gql`
        mutation ($user: users_set_input!, $user_id: users_pk_columns_input!){
            update_users_by_pk(_set: $user, pk_columns: $user_id) {
                id
                first_name
                last_name
                email
                tiktok_list
            }
        } 
    `
    const variables = {
        user: {
            tiktok_list: tiktokList
        }, 
        user_id: {
            id: userId
        }
    }

    //try to update user's tiktok vid list
    try {
        const data = await graphQLClient.request(UPDATE_USER_MUTATION, variables)
        console.log("UPDATE USER VIDEO LIST MUTATION RESP --> ", JSON.stringify(data))
    } catch (error) {
        console.log("UPDATE USER VIDEO LIST MUTATION ERR --> ", error)
    }
}


async function notifyLevelUp(req, res) {
    const { level, score, artist, phoneNumber } = req.body; // why was the console in my local react app giving me a cors error when it was just that I was trying to access these props via req.body.data??? was the res not set yet? need better error handling
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    const msg = `Wooow ${score} points. Good job. Your replay will be ready on TikTok shortly.` //having routing to the level would be cool here
    try {
        const response = await client.messages
            .create({
                body: msg,
                from: `${process.env.TWILIO_PHONE_NUMBER}`,
                to: phoneNumber
            });
        
        console.log(response.sid);
        res.json(response.sid);
    } catch (error) {
        console.log(error);
        res.json("Could not send level up sms --> ", error);
    }
}        

async function sendTwilioSMS(msg, phoneNumber) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);

    try {
        const response = await client.messages
            .create({
                body: msg,
                from: `${process.env.TWILIO_PHONE_NUMBER}`,
                to: phoneNumber
            }); 
        console.log(response.sid);
        return response.sid;
    } catch (error) {
        console.log("Could not sms --> ", error);
        return error;
    }
}

// sendTwilioSMS("So you think you stan the 1975? You just joined the game. Congrats.", "+16412319737")
// RBAC Role based access control --> given a role what resoruces is role allowed to access