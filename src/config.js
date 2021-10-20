const { MODE } = require("./blendMode.js");
const description =
  "The genesis KOIOS Titan NFT collection. Build with ❤ by group 28.";
const baseUri = "ipfs://";

const layerConfigurations = [
  {
    growEditionSizeTo: 1,
    layersOrder: [
      { name: "background" },
      { name: "skins" },
      { name: "eyes" },
      { name: "hair" },
      { name: "mouth" },
    ],
  },
];

const format = {
  width: 2000,
  height: 2000,
};

const background = {
  generate: true,
  brightness: "80%",
};

const preview = {
  thumbPerRow: 5,
  thumbWidth: 50,
  imageRatio: format.width / format.height,
  imageName: "preview.png",
};

const rarityDelimiter = "#";

const uniqueDnaTorrance = 10000;

module.exports = {
  format,
  baseUri,
  description,
  background,
  uniqueDnaTorrance,
  layerConfigurations,
  rarityDelimiter,
  preview,
};
