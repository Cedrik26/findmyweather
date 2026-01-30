import express from "express";

const app = express();

app.get("/", (req: string, res: string) => {
    res.send("Hello World!");
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});