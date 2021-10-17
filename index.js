import express from "express";
import Moralis from "moralis";
import { create } from "ipfs-http-client";
import Web3 from "web3";
import fs from "fs";
import { ABI } from "./ABI.js";

const app = express();
const PORT = process.env.PORT || 1337;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const privateKey = process.env.PRIVKEY;
const ipfsClient = create("https://ipfs.infura.io:5001");

let image;
let web3 = new Web3(
  "https://rinkeby.infura.io/v3/8e4de63cfa6842e2811b357d94423d01"
);
let contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
let account = web3.eth.accounts.privateKeyToAccount("0x" + privateKey);

Moralis.initialize(process.env.APP_ID, "", process.env.MASTER_KEY);
Moralis.serverURL = process.env.SERVER_URL;

app.listen(PORT, function () {
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;
  contract.defaultChain = "rinkeby";
  contract.defaultHardfork = "london";

  init();
});

const getImage = () =>
  fs.readFile("bart.png", function (err, data) {
    if (data) {
      image = data;
      console.log(image);
    }
    if (err) {
      console.log(err);
    }
  });

const btoa = function (str) {
  return Buffer.from(str).toString("base64");
};

init = async () => {
  console.log("I have been summoned!!");
  let query = new Moralis.Query("KekwTokenEvents");
  let subscription = await query.subscribe();
  subscription.on("create", onTokenMint);
  getImage();
};

onTokenMint = async (token) => {
  try {
    console.log("Minting... Token ID:" + token.attributes.tokenID);
    lol(token.attributes.tokenID);
  } catch (err) {
    console.log("Error Occured: ");
    console.log(err);
  }
};

async function lol(tokenID) {
  console.log("Metadata Minter has been summoned: ");
  console.log("A token with ID: [" + tokenID + "] has been Minted.");
  const gasLimit = await contract.methods
    ._setTokenURI(
      tokenID,
      "https://ipfs.io/ipfs/Qmc31eQ8M68cEEukWYzynL2e56yEh5iJ3uXyYrwCVsSjxSasdasdad"
    )
    .estimateGas({
      from: web3.eth.defaultAccount,
    });

  console.log("Gas For Function: " + gasLimit);
  const latestBlock = await web3.eth.getBlock("latest");
  const blockGas = latestBlock.gasLimit / 100000000000;
  console.log("Gas For Gwei: " + blockGas + " ETH");

  const addedImage = await ipfsClient.add(image);
  console.log("Image Data: ");
  console.log(addedImage);
  const metadata = {
    name: "Kekw",
    description: "A collection of KEKWs",
    image: "https://ipfs.io/ipfs/" + addedImage.path,
    attributes: [{ type: "ID", value: tokenID }],
  };
  const addedMetadata = await ipfsClient.add(JSON.stringify(metadata));
  console.log("Final Path: ");
  console.log("https://ipfs.io/ipfs/" + addedMetadata.path);

  const finalIpfs = addedMetadata.path;
  contract.methods
    ._setTokenURI(tokenID, finalIpfs)
    .send({
      from: web3.eth.defaultAccount,
      gasLimit: gasLimit,
    })
    .on("transactionHash", function (hash) {
      console.log(hash);
    });
}
