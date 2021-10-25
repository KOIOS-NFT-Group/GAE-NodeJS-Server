const fs = require("fs");
const path = require("path");
const sha1 = require("sha1");
const { createCanvas, loadImage } = require("canvas");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const buildDir = `${basePath}/build`;
const layersDir = `${basePath}/layers`;
const {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
} = require(path.join(basePath, "/src/config.js"));
const console = require("console");
const canvas = createCanvas(format.width, format.height);
const ctx = canvas.getContext("2d");

//IPFS Pinning setup for Infura
const ipfsClient = require("ipfs-http-client");

const auth =
  "Basic " +
  Buffer.from(
    process.env.IPFS_PROJECT_ID + ":" + process.env.IPFS_PROJECT_SECRET
  ).toString("base64");

const client = ipfsClient.create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: auth,
  },
});

//Contract stuff
const ABI = require("../ABI.json");
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const privateKey = process.env.PRIV_KEY;
const Web3 = require("web3");
let web3 = new Web3(
  "https://rinkeby.infura.io/v3/8e4de63cfa6842e2811b357d94423d01"
);

let contract = new web3.eth.Contract(JSON.parse(ABI.result), CONTRACT_ADDRESS);
let account = web3.eth.accounts.privateKeyToAccount("0x" + privateKey);

var attributesList = [];
var dnaList = [];
var metadata;

const buildSetup = () => {
  if (fs.existsSync(buildDir)) {
    fs.rmdirSync(buildDir, { recursive: true });
  }
  fs.mkdirSync(buildDir);
  fs.mkdirSync(`${buildDir}/json`);
  fs.mkdirSync(`${buildDir}/images`);
};

const getRarityWeight = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = Number(
    nameWithoutExtension.split(rarityDelimiter).pop()
  );
  if (isNaN(nameWithoutWeight)) {
    nameWithoutWeight = 0;
  }
  return nameWithoutWeight;
};

const cleanDna = (_str) => {
  var dna = Number(_str.split(":").shift());
  return dna;
};

const cleanName = (_str) => {
  let nameWithoutExtension = _str.slice(0, -4);
  var nameWithoutWeight = nameWithoutExtension.split(rarityDelimiter).shift();
  return nameWithoutWeight;
};

const getElements = (path) => {
  return fs
    .readdirSync(path)
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item))
    .map((i, index) => {
      return {
        id: index,
        name: cleanName(i),
        filename: i,
        path: `${path}${i}`,
        weight: getRarityWeight(i),
      };
    });
};

const layersSetup = (layersOrder) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    name: layerObj.name,
    elements: getElements(`${layersDir}/${layerObj.name}/`),
    blendMode:
      layerObj["blend"] != undefined ? layerObj["blend"] : "source-over",
    opacity: layerObj["opacity"] != undefined ? layerObj["opacity"] : 1,
  }));
  return layers;
};

const saveImage = (_editionCount) => {
  fs.writeFileSync(
    `${buildDir}/images/${_editionCount}.png`,
    canvas.toBuffer("image/png")
  );
};

const genColor = () => {
  let hue = Math.floor(Math.random() * 360);
  let pastel = `hsl(${hue}, 100%, ${background.brightness})`;
  return pastel;
};

const drawBackground = () => {
  ctx.fillStyle = genColor();
  ctx.fillRect(0, 0, format.width, format.height);
};

const addMetadata = async (_dna, _tokenID) => {
  let dateTime = Date.now();
  const addedImage = await client.add(
    fs.readFileSync(`${buildDir}/images/${_tokenID}.png`),
    { pin: true }
  );

  let tempMetadata = {
    dna: sha1(_dna.join("")),
    name: "KOIOS Titan " + `#${_tokenID}`,
    description: description,
    image: baseUri + addedImage.path,
    edition: _tokenID,
    date: dateTime,
    attributes: attributesList,
  };
  metadata = tempMetadata;
  saveMetaDataSingleFile(_tokenID);
  uploadAndSet(_tokenID);
  attributesList = [];
};

const saveMetaDataSingleFile = (_tokenID) => {
  fs.writeFileSync(
    `${buildDir}/json/${_tokenID}.json`,
    JSON.stringify(metadata, null, 2)
  );
};

async function uploadAndSet(_tokenID) {
  web3.eth.accounts.wallet.add(account);
  web3.eth.defaultAccount = account.address;
  contract.defaultChain = "rinkeby";
  contract.defaultHardfork = "london";
  const gasLimit = await contract.methods
    ._setTokenURI(
      _tokenID,
      "https://ipfs.io/ipfs/Qmc31eQ8M68cEEukWYzynL2e56yEh5iJ3uXyYrwCVsSjxSasdasdad"
    )
    .estimateGas({
      from: web3.eth.defaultAccount,
    });

  console.log("Gas For Function: " + gasLimit);
  const latestBlock = await web3.eth.getBlock("latest");
  const blockGas = latestBlock.gasLimit / 100000000000;
  console.log("Gas For Gwei: " + blockGas + " ETH");

  console.log(JSON.stringify(metadata, null, 2));
  const addedMetadata = await client.add(JSON.stringify(metadata, null, 2), {
    pin: true,
  });
  console.log("Final Path: ");
  console.log("https://ipfs.io/ipfs/" + addedMetadata.path);

  const finalIpfs = addedMetadata.path;
  const nonce = await web3.eth.getTransactionCount(web3.eth.defaultAccount);
  console.log("Nonce for account: " + nonce);
  contract.methods
    ._setTokenURI(_tokenID, finalIpfs)
    .send({
      from: web3.eth.defaultAccount,
      gasLimit: gasLimit,
      nonce: nonce,
    })
    .on("transactionHash", function (hash) {
      console.log(hash);
    });
}

const addAttributes = (_element) => {
  let selectedElement = _element.layer.selectedElement;
  attributesList.push({
    trait_type: _element.layer.name,
    value: selectedElement.name,
  });
};

const loadLayerImg = async (_layer) => {
  return new Promise(async (resolve) => {
    const image = await loadImage(`${_layer.selectedElement.path}`);
    resolve({ layer: _layer, loadedImage: image });
  });
};

const drawElement = (_renderObject) => {
  ctx.globalAlpha = _renderObject.layer.opacity;
  ctx.globalCompositeOperation = _renderObject.layer.blendMode;
  ctx.drawImage(_renderObject.loadedImage, 0, 0, format.width, format.height);
  addAttributes(_renderObject);
};

const constructLayerToDna = (_dna = [], _layers = []) => {
  let mappedDnaToLayers = _layers.map((layer, index) => {
    let selectedElement = layer.elements.find(
      (e) => e.id == cleanDna(_dna[index])
    );
    return {
      name: layer.name,
      blendMode: layer.blendMode,
      opacity: layer.opacity,
      selectedElement: selectedElement,
    };
  });
  return mappedDnaToLayers;
};

const isDnaUnique = (_DnaList = [], _dna = []) => {
  let foundDna = _DnaList.find((i) => i.join("") === _dna.join(""));
  return foundDna == undefined ? true : false;
};

const createDna = (_layers) => {
  let randNum = [];
  _layers.forEach((layer) => {
    var totalWeight = 0;
    layer.elements.forEach((element) => {
      totalWeight += element.weight;
    });
    // number between 0 - totalWeight
    let random = Math.floor(Math.random() * totalWeight);
    for (var i = 0; i < layer.elements.length; i++) {
      // subtract the current weight from the random weight until we reach a sub zero value.
      random -= layer.elements[i].weight;
      if (random < 0) {
        return randNum.push(
          `${layer.elements[i].id}:${layer.elements[i].filename}`
        );
      }
    }
  });
  return randNum;
};

const startCreating = async (tokenID) => {
  let layerConfigIndex = 0;
  let editionCount = 1;
  let failedCount = 0;

  while (layerConfigIndex < layerConfigurations.length) {
    const layers = layersSetup(
      layerConfigurations[layerConfigIndex].layersOrder
    );
    while (
      editionCount <= layerConfigurations[layerConfigIndex].growEditionSizeTo
    ) {
      let newDna = createDna(layers);
      if (isDnaUnique(dnaList, newDna)) {
        let results = constructLayerToDna(newDna, layers);
        let loadedElements = [];

        results.forEach((layer) => {
          loadedElements.push(loadLayerImg(layer));
        });

        await Promise.all(loadedElements).then((renderObjectArray) => {
          ctx.clearRect(0, 0, format.width, format.height);
          if (background.generate) {
            drawBackground();
          }
          renderObjectArray.forEach((renderObject) => {
            drawElement(renderObject);
          });
          saveImage(tokenID);
          addMetadata(newDna, tokenID);
          console.log(
            `Created edition: ${tokenID}, with DNA: ${sha1(newDna.join(""))}`
          );
        });
        dnaList.push(newDna);
        editionCount++;
      } else {
        console.log("DNA exists!");
        failedCount++;
        if (failedCount >= uniqueDnaTorrance) {
          console.log(
            `You need more layers or elements to grow your edition to ${layerConfigurations[layerConfigIndex].growEditionSizeTo} artworks!`
          );
          process.exit();
        }
      }
    }
    layerConfigIndex++;
  }
};

module.exports = { startCreating, buildSetup, getElements };
