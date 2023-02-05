require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const fs = require('fs');
const multer = require('multer');
const { Configuration, OpenAIApi } = require("openai");
const sharp = require('sharp');

const token = process.env.API_TOKEN
const configuration = new Configuration({ apiKey: token });
const openai = new OpenAIApi(configuration);

const app = express();
app.use(cors());

const MAX_NUMBER = 1;
const IMAGE_SIZE = "256x256";
// const IMAGE_SIZE = "1024x1024";

const storage = multer.diskStorage({
    destination: __dirname + `/images`,
    limits: {
        fileSize: 10000000 // 10000000 Bytes = 10 MB
    },
    filename: (req, file, cb) => {
        try {
            if (!/^image/.test(file.mimetype)) throw new Error("Please upload an Image.");
            cb(null, 'ai.png')
        } catch (error) {
            console.log(error)
        };
    }
});

const upload = multer({
    storage: storage,
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) cb(new Error('Please upload an image.'));
        cb(undefined, true);
    }
});

app.post("/alter_image", upload.single('upload'), async (req, res) => {
    try {
        if (!/^image/.test(req.file.mimetype)) throw new Error("Please upload an Image.");
        if (req.file.size >= 40_000_000) throw new Error("File size is too big, please try it again with a file that is around 4MB");

        await sharp(__dirname + '/images/ai.png')
            .resize(500, 500)
            .toFormat('png')
            .toFile(__dirname + '/images/output.png');


        const compressedFileSize = fs.statSync(__dirname + "/images/output.png").size;
        if (compressedFileSize >= 3_900_000) throw new Error("File size is too big, please try it again with a file that is less than 4MB");

        const response = await openai.createImageVariation(
            fs.createReadStream(__dirname + "/images/output.png"),
            MAX_NUMBER,
            IMAGE_SIZE
        );

        fs.unlinkSync(__dirname + "/images/ai.png");
        fs.unlinkSync(__dirname + "/images/output.png");

        res.status(200).json({ res: response.data.data });
    } catch (error) {
        switch (error) {
            case error.response:
                console.log(error.response.data);
                res.status(500).json({ message: error.response.data });
                break;
            case error.message:
                console.log(error.message);
                res.status(500).json({ message: error.message });
                break;
            default:
                console.log(error)
                res.status(500).json({ message: error });
        };
    };
});

app.use(bodyParser.json());
app.post("/message", (req, res) => {
    const response = openai.createCompletion({
        model: "text-davinci-003",
        prompt: req.body.prompt,
        temperature: 0,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        max_tokens: 1024
    });
    response.then(data => {
        res.send({ message: data.data.choices[0].text })
    });
});

app.post("/image", async (req, res) => {
    try {
        const response = await openai.createImage({
            prompt: req.body.prompt,
            n: MAX_NUMBER,
            size: IMAGE_SIZE
        })
        res.status(200).json({ message: response.data.data })
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: response })
    };
});

app.listen(process.env.PORT, () => {
    console.log(`App is spinning on port ${process.env.PORT}`);
});