import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const createUser = `
mutation createUser($id: String = "", $name: String = "") {
  insert_users_one(object: {id: $id, name: $name},
    on_conflict: {constraint: users_pkey, update_columns: []}) {
    id
    name
  }
}
`;

exports.processSignUp = functions.auth.user().onCreate(async (user) => {
  const customClaims = {
    "https://hasura.io/jwt/claims": {
      "x-hasura-default-role": "user",
      "x-hasura-allowed-roles": ["user"],
      "x-hasura-user-id": user.uid,
    },
  };
  const userUid = user.uid;

  // admin.auth().getUser() 経由で取得, 取得するまでawait
  const authedUser = await admin.auth().getUser(userUid);
  const userName = authedUser.displayName;
  // const userName = "test";

  return admin
      .auth()
      .setCustomUserClaims(userUid, customClaims)
      .then(() => {
        // Update real-time database to notify client to force refresh.
        // Set the refresh time to the current UTC timestamp.
        // This will be captured on the client to force a token refresh.
        const adminSecret = "password12345";
        const url = "http://localhost:8080/v1/graphql";
        // const now = admin.firestore.FieldValue.serverTimestamp();

        const queryStr = {
          "query": createUser,
          "variables": {
            id: userUid, name: userName},
        };

        axios({
          method: "post",
          url: url,
          data: queryStr,
          headers: {
            "x-hasura-admin-secret": adminSecret,
          },
        }).then((response) => {
          console.log("status:", response.status);
          console.log("body:", response.data);
        });
      })
      .catch((error) => {
        console.log(error);
      });
});
