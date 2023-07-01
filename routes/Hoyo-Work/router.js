const myLog = Function.prototype.bind.call(console.log, console, "Hoyo Work: ");
const myError = Function.prototype.bind.call(console.error, console, "Hoyo Work: ");
const myWarn = Function.prototype.bind.call(console.warn, console, "Hoyo Work: ");


const express = require("express");
const path = require("path");
const {MongoClient} = require("mongodb");
const fetch = require("node-fetch");
const nSchedule = require("node-schedule");

require("dotenv").config();


const publicDir = path.join(__dirname, "public");

const router = express.Router();


class MongoWrapper {
  constructor(key, db = undefined, coll = undefined) {
    this.cluster = new MongoClient(key);

    if (db)
      this.db = this.cluster.db(db);
    if (db && coll)
      this.coll = this.db.collection(coll);
  }
  _close() {
    return this.cluster.close();
  }
  _find_one(filter) {
    return this.coll.findOne(filter);
  }
  async find_one_by_id(_id) {
    let doc = undefined;

    try {
      doc = await this._find_one({_id: _id});
      myLog("MongoWrapper: found one document with _id:", _id);
    }
    catch (err) {
      myError("Error MongoWrapper - find_one_by_id:", _id, err);
    }

    return doc;
  }
  _update_one(filter, update, options = undefined) {
    return this.coll.updateOne(filter, update, options);
  }
  async update_one_with_set_by_id(_id, doc, options = undefined) {
    try {
      await this._update_one({_id: _id}, {"$set": doc}, options);
      myLog("MongoWrapper: updated one document with _id:", _id);
    }
    catch (err) {
      myError("Error MongoWrapper - update_one_by_id:", _id, err);
    }
  }
}


function shortenFloatStr(numStr) {
  const numStrSplit = numStr.split(".");

  if (numStrSplit.length < 2) {
    return numStr;
  }

  const newNumStr = numStrSplit[0] + "." + numStrSplit[1][0];
  return newNumStr;
}

async function sendDiscordMessage(messageObj, url) {
  try {
    const response = await fetch(url, {method: "post", headers: {"Content-Type": "application/json"}, body: JSON.stringify(messageObj)});

    if (!response.ok) throw `${response.status}: ${await response.text()}`;

    myLog("Requested Discord webhook send message:", response.status);
  }
  catch (err) {
    myError("Error sending Discord webhook message:", err);
  }
}

async function processGenshinWork(fireDate) {
  try {
    const db_wrapper = new MongoWrapper(process.env.MONGODB_KEY, "swty-db", "swty-coll-work");
    
    const workDetails = await db_wrapper.find_one_by_id("genshin");

    if (!workDetails.active) return;

    const webhookUrl = process.env.HOYO_WORK_MESSENGER_URL;
    const hoyoBasicAuthStr = process.env.HOYO_WORK_KEYS;
    const hoyoDataUrl = process.env.HOYO_WORK_DATA_URL;
    
    if (!hoyoBasicAuthStr) {
      myError("Error processGenshinWork: hoyoAuth is invalid");
      return;
    };
  
    try {
      const response = await fetch(hoyoDataUrl, {method: "post", headers: {Authorization: "Basic " + Buffer.from(hoyoBasicAuthStr).toString("base64")}});

      if (!response.ok) throw `${response.status}: ${await response.text()}`;

      var data = await response.json();
    }
    catch (err) {
      myError(`Fetch ${hoyoDataUrl} error: ${err}`);
      return;
    }

    //const currentDt = console.log(new Date().toLocaleString("ru", {timeZone: "Europe/Moscow"}));
    const currentDt = fireDate;
    const currentDtStr = currentDt.toLocaleString("ru", {timeZone: "Europe/Moscow"});
    const currentDayNum = Number(currentDtStr.split(".", 1)[0]);

    if (currentDayNum == workDetails.end_day) {
      workDetails.pay_total = 0.0;
      workDetails.days_passed = 0;
    }

    const dayCompleted = (data.completed_commissions == data.max_commissions && data.claimed_commission_reward) ? true : false;

    const cyclePayUpdated = dayCompleted ? workDetails.pay_total + workDetails.pay_per_day : workDetails.pay_total;
    const cycleDaysPassedUpdated = workDetails.days_passed + 1;

    let dayStatusMsg = `${dayCompleted ? ":white_check_mark:" : ":x:"} - Completed: **${data.completed_commissions}**/${data.max_commissions}, Reward **${data.claimed_commission_reward ? "claimed" : "not claimed"}**`;
    let dayPayPlusMsg = `${shortenFloatStr(workDetails.pay_total.toString())}+${(dayCompleted ? shortenFloatStr(workDetails.pay_per_day.toString()) : "0")}=**${shortenFloatStr(cyclePayUpdated.toString())}**`;

    const message = {embeds: [{description: `Day: **${cycleDaysPassedUpdated}** - ${dayStatusMsg}. Expected payment: ${dayPayPlusMsg}.`}]};

    await sendDiscordMessage(message, webhookUrl);

    await db_wrapper.update_one_with_set_by_id("genshin", {pay_total: cyclePayUpdated, days_passed: cycleDaysPassedUpdated, last_checked_day: currentDayNum});

    db_wrapper._close();
  }
  catch (err) {
    myError("Error processGenshinWork:", err);
  }
}


(async () => {
  const nScheduleRule = new nSchedule.RecurrenceRule();
  nScheduleRule.hour = 5;
  nScheduleRule.minute = 30;
  nScheduleRule.second = 0;
  //nScheduleRule.second = 30;
  nScheduleRule.tz = "Europe/Moscow";
  const hoyoWorkJob = nSchedule.scheduleJob(nScheduleRule, processGenshinWork);
})();

module.exports = router;