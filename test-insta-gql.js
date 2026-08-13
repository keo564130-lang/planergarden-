const url = 'https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables={"shortcode":"C8qL8Zsoq6n"}';
fetch(url).then(r => r.json()).then(t => console.log(JSON.stringify(t))).catch(e => console.log('Error', e));
