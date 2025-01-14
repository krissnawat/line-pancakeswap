import "dotenv/config";

import { Masterchef, getPositions } from "./services/masterchef";
import {
  addressBar,
  poolLine,
  summary,
  tableHeader,
} from "./views/flexTemplate";
import { get, sortBy } from "lodash";
import { isValidAddress, shortenAddress } from "./utils";

import { Client } from "@line/bot-sdk";
import MasterChef from "./abi/MasterChef.json";
import { PriceService } from "./services/priceService";
import { TokenHelper } from "./services/tokenHelper";
import { Web3Service } from "./services/web3Service";
import bodyParser from "body-parser";
import express from "express";
import { pools } from "./constants/pools";

// Init Express
const app = express();
app.use(bodyParser.json());
const port = 8080;

// Init LINE SDK
const lineClient = new Client({
  channelAccessToken: '3urvdX0loGGQ3BxpF79KNDbJ8/3UbNtGXJhEBG3uXOV38uAA7HxpuoTVxb2qHe+hNW2oQvL/TGBI2YoXlUyK5VcS/TcAovkILAH6lGOGQCsnWDd6gTiIxo4DvzolgPe209j+azJpRBBdxRz+A1sV0gdB04t89/1O/w1cDnyilFU=',
});

// Init Masterchef
const web3Service = new Web3Service();
const priceService = new PriceService();
const masterchefAddress = "0xde866dD77b6DF6772e320dC92BFF0eDDC626C674";
const contract = web3Service.getContract(MasterChef.abi, masterchefAddress);
const helper = new TokenHelper(web3Service, priceService);
const masterchef = new Masterchef(contract, helper);

// Webhook
app.post("/webhook", async (req, res) => {
  const event = get(req, ["body", "events", "0"]);
  const eventType = get(event, ["message", "type"]);
  const message = get(event, ["message", "text"]);
  const replyToken = get(event, "replyToken") as string;

  // Validate input message
  if (eventType !== "text" || !isValidAddress(message)) {
    await lineClient.replyMessage(replyToken, {
      type: "text",
      text:
        "Please input valid BSC address. For example, 0x3c74c735b5863c0baf52598d8fd2d59611c8320f 🐳",
    } as any);
    return res.sendStatus(200);
  }

  // Get poolInfos and store it to fetch faster
  // const pools = await masterchef.getPoolInfos();

  const address = message;
  const stakings = await masterchef.getStaking(pools, address);
  const positions = sortBy(
    stakings.map((stake) => getPositions(stake)),
    ["totalValue"]
  ).reverse();
  const totalValue = positions.reduce(
    (sum, position) => sum + position.totalValue,
    0
  );

  await lineClient.replyMessage(replyToken, {
    type: "flex",
    altText: "Pancake Staking",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          addressBar(shortenAddress(address)),
          tableHeader(),
          ...positions.map((position) => poolLine(position)),
          summary(totalValue),
        ],
      },
    },
  } as any);
  return res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Server is running at https://localhost:${port}`);
});
