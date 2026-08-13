const handler = require('./api/parse-url.js');

const req = {
  method: 'GET',
  query: { url: 'https://vk.com/wall-212711849_12' }
};

const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log('Status:', this.statusCode);
    console.log(data);
  }
};

handler(req, res).catch(console.error);
