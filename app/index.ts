import express from "express";
import { V1 } from "./v1";

const app = express();
app.use(express.json());

app.use("/v1", V1);
app.listen(5555, () => {
  console.log("authorization api started!");
});
