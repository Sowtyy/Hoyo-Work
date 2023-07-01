const myLog = Function.prototype.bind.call(console.log, console, "Server: ");
const myError = Function.prototype.bind.call(console.error, console, "Server: ");
const myWarn = Function.prototype.bind.call(console.warn, console, "Server: ");

myLog("Launching...");


const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {promisify} = require("util");

//const tempuploadsRouter = require("./routes/temp-uploads/router.js");
//const rootRouter = require("./routes/root/router.js");
//const manifest = require("./public/manifest.json");


const VERSION = "1.0.0";
const VERSION_DATE = "01.07.2023 @ 04";
const PROTOCOL = process.env.PROTOCOL || "http";
const PORT = process.env.PORT || 8080;
const HOSTNAME = process.env.HOSTNAME;
const HOSTNAME_LOCAL = getipv4() || "localhost";
const HOSTNAME_PORT = `${HOSTNAME || HOSTNAME_LOCAL}:${PORT}`;
const PROT_HOSTNAME = `${PROTOCOL}://${HOSTNAME || HOSTNAME_LOCAL}`;
const PROT_HOSTNAME_PORT = `${PROTOCOL}://${HOSTNAME_PORT}`;
const COMPLETE_URL = HOSTNAME ? PROT_HOSTNAME : PROT_HOSTNAME_PORT;
const PRODUCTION = process.env.NODE_ENV == "production";

myLog(PROTOCOL, PORT, HOSTNAME, HOSTNAME_LOCAL, HOSTNAME_PORT, PROT_HOSTNAME, PROT_HOSTNAME_PORT, COMPLETE_URL, PRODUCTION);


const publicDir = path.join(__dirname, "public");
let startedAt = 0;


const app = express();

app.enable("trust proxy");


function getUrl(req) {
  let result = `${req.protocol}://${req.hostname}`;
  if (!HOSTNAME) {
    result += `:${PORT}`;
  }
  result += `${req.originalUrl}`;
  return result;
}

function getipv4() {
  const nets = os.networkInterfaces();
  const results = {};

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      
      if (net.family === familyV4Value && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }

  myLog(results);
  
  const result = Object.values(results)[0][0];
  myLog(result);
  return result;
}

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

function sendNotFound(req, res, next) {
  res.status(404).sendFile(path.join(publicDir, "not-found.html"));
}


(async () => {
  myLog();

  app.use((req, res, next) => {
    const usedUrl = getUrl(req);
    const usedUrlSplit = usedUrl.split(".");
    let toShow = true;
    
    const endingsHide = ["js", "css", "json"];

    for (const ending of endingsHide) {
      if (usedUrlSplit[usedUrlSplit.length - 1].endsWith(ending)) {
        toShow = false;
        break;
      }
    }

    if (toShow) myLog(`${req.method}:  ${usedUrl}`);
    
    next();
  });

  const routesPath = path.join(__dirname, "routes");
  const routes = await promisify(fs.readdir)(routesPath);

  for (const routeDirName of routes) {
    const routeDirPath = path.join(routesPath, routeDirName);
    const routeManifestPath = path.join(routeDirPath, "public", "manifest.json");
    const routerPath = path.join(routeDirPath, "router.js");

    const routeManifest = JSON.parse(await promisify(fs.readFile)(routeManifestPath, {encoding: "utf-8"}));

    app.use(routeManifest.url, require(routerPath));
    myLog("Linked router:", routeDirName, routeManifest.name, routeManifest.url);
  }

  //await sleep(1000);

  //app.use("/", require("./routes/root/router.js"));

  //app.use("/temp-uploads", tempuploadsRouter);
  //app.use("/", rootRouter);

  app.use(express.static(publicDir));
  app.use(sendNotFound);


  app.listen(PORT, PRODUCTION ? undefined : (HOSTNAME || HOSTNAME_LOCAL), async () => {
    startedAt = Date.now();
  
    myLog();
    myLog(`Listening... Port: ${PORT}. URL: ${COMPLETE_URL}.`);
    myLog(`Local URL: ${PROTOCOL}://${HOSTNAME_LOCAL}:${PORT}.`);
    myLog(`Server: Version: ${VERSION}. Date: ${VERSION_DATE}.`);
    //myLog(`Manifest: Name: ${manifest.name}. Author: ${manifest.author}. Version: ${manifest.version}. Date: ${manifest.date}.`);
    myLog(`Server started at: ${startedAt}.`);
    myLog(`Server platform: ${process.platform}.`);
    myLog();
  
  
    /*
    manifest.startedAt = startedAt;
    try {
      await promisify(fs.writeFile)(path.join(publicDir, "manifest.json"), JSON.stringify(manifest, undefined, 2));
      myLog(`${manifest.name}: Updated manifest.json 'startedAt'.`);
    }
    catch (err) {
      myError(`${manifest.name}: Error updating manifest.json 'startedAt':`, err);
    }
    */
  
  });
})();
