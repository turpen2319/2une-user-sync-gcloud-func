const { GraphQLClient, gql } = require('graphql-request');
const axios = require('axios').default;
const endpoint = process.env.GQL_ENDPOINT || 'http://localhost:8080/v1/graphql';

module.exports = {
    insertUser,
    updateUser,
}


const graphQLClient = new GraphQLClient(endpoint, {
    headers: {
        contentType: 'application/json',
        authorization: 'Bearer MY_TOKEN',
        "x-hasura-admin-secret": process.env.ADMIN_SECRET
    },
})

async function insertUser(req, res) {

    const INSERT_USER_MUTATION = gql`
        mutation ($entry: users_insert_input!) {
            insert_users_one (object: $entry) {
                id
                email
                first_name
                last_name
            }
        }
    `
    const { id, email_addresses, first_name, last_name, profile_image_url } = req.body.data;
    const variables = {
        entry: {
            id: id,
            email: email_addresses[0].email_address,
            first_name: first_name,
            last_name: last_name,
            profile_image_url: profile_image_url

        }
    }
    const data = await graphQLClient.request(INSERT_USER_MUTATION, variables)
    console.log(JSON.stringify(data, undefined, 2))
    res.send(data)
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
    const { id, email_addresses, first_name } = req.body.data;
    const variables = {
        user: {
          email: email_addresses[0].email_address,
          first_name: first_name
        },
        user_id: {
          id: id
        }
    }

    const data = await graphQLClient.request(UPDATE_USER_MUTATION, variables);
    console.log(JSON.stringify(data, 'hello', 2));
    res.send(data);
}




// RBAC Role based access control --> given a role what resoruces is role allowed to access