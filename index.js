const express = require('express');

const PORT = process.env.PORT || 3000;
const app = express();
const server = app.listen(PORT, function () {
    console.log('Server is running on http://localhost:' + PORT);
});