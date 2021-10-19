const express = require("express");
const Moralis = require("moralis/node");
const Web3 = require("web3");

const { startCreating } = require("./src/main.js");

const app = express();
const PORT = process.env.PORT || 1330;

Moralis.initialize(process.env.APP_ID, "", process.env.MASTER_KEY);
Moralis.serverURL = process.env.SERVER_URL;

app.listen(PORT, function () {
  init();
});

async function init() {
  console.log("I have been summoned!!");
  let stopped = false;
  while (!stopped) {
    await new Promise((resolve) => setTimeout(resolve, 30000));
    resolveMetadata();
  }
}

async function resolveMetadata() {
  let query = new Moralis.Query("KekwTokenEvents");
  query.equalTo("metadata", "False");
  console.log("Checking new mints...");
  const kekwTokenevents = await query.find();
  for (let event of kekwTokenevents) {
    console.log(
      "Token ID does [ " + event.attributes.tokenID + " ] not have Metadata"
    );
    try {
      console.log("Generating metadata and storing on IPFS...");
      startCreating(event.attributes.tokenID);
      await new Promise((resolve) => setTimeout(resolve, 15000));
      event.set("metadata", "True");
      event.save();
    } catch (e) {
      console.log(e);
    }
  }
}
