const express = require('express');
const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname)));

app.listen(8000, () => {
  console.log('✅ Avatar server running at http://localhost:8000');
});
