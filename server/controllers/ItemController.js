const express = require("express");
const router = express.Router();

router.get("/", function(req, res) {
    res.send("got items");
});

module.exports = router;