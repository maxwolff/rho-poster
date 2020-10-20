const ethers = require("ethers");
const yargs = require("yargs");
const https = require("https");
const assert = require("assert");

const bn = (num) => {
  return ethers.BigNumber.from(num);
};

const fetch = async (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (d) => {
        data += d;
      });
      res.on("end", () => {
        resolve(JSON.parse(data));
      });
    });
  });
};

const abi = [
  "function SWAP_MIN_DURATION() returns (uint)",
  "function close(bool userPayingFixed, uint benchmarkInitIndex, uint initBlock, uint swapFixedRateMantissa, uint notionalAmount, uint userCollateralCTokens, address owner) external",
];

const getConfig = (networkName) => {
  return require("./networks/" + networkName + ".json");
};

const close = async () => {
  const parsed = yargs
    .option("network", { description: "network", type: "string" })
    .option("gas-price", {
      alias: "gp",
      description: "gas price",
      type: "number",
    })
    .demandOption(["network"], "Provide all the arguments").argv;

  const provider = new ethers.providers.JsonRpcProvider(
    `https://${parsed.network}-eth.compound.finance`
  );
  const { rho: rhoAddr } = getConfig(parsed.network);

  const pk = process.env.POSTER_KEY;
  assert(pk, "No pk");
  const signer = new ethers.Wallet(pk, provider);

  const rho = new ethers.Contract(rhoAddr, abi, signer);

  const resp = await fetch(
    "https://rho-backend-dot-rho-proj.uc.r.appspot.com/pending"
  );
  console.log(resp);
  const dur = await rho.callStatic.SWAP_MIN_DURATION();
  const currBn = await provider.getBlockNumber();
  for (let pending of Object.values(resp)) {
    if (
      bn(pending.blockNumber)
        .add(dur)
        .lt(currBn)
    ) {
      const {
        benchmarkIndexInit,
        initBlock,
        notionalAmount,
        owner,
        swapFixedRateMantissa,
        swapHash,
        userCollateralCTokens,
        userPayingFixed,
      } = pending.data;
      const tx = await rho.close(
        userPayingFixed,
        benchmarkIndexInit,
        initBlock,
        swapFixedRateMantissa,
        notionalAmount,
        userCollateralCTokens,
        owner
      );
      console.log(tx);
    }
  }
};

try {
  const loop = async () => {
    setTimeout(async () => {
      console.log("polling ..");
      await close();
      loop();
    });
  };
  loop();
} catch (e) {
  throw e;
}
