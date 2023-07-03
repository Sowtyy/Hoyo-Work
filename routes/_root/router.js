const myLog = Function.prototype.bind.call(console.log, console, "Root: ");
const myError = Function.prototype.bind.call(console.error, console, "Root: ");
const myWarn = Function.prototype.bind.call(console.warn, console, "Root: ");


const express = require("express");
const path = require("path");


const publicDir = path.join(__dirname, "public");
const startedAt = Date.now();

const router = express.Router();

router.get("/", (req, res) => {
  res.send(`Started at: ${startedAt}.`);
});

(async () => {
  myLog(`Started at: ${startedAt}.`);
})();

module.exports = router;