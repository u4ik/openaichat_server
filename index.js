require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const fs = require('fs');
const multer = require('multer');
const token = process.env.API_TOKEN
const configuration = new Configuration({ apiKey: token });
const openai = new OpenAIApi(configuration);

const sharp = require('sharp');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const MAX_NUMBER = 1;
const IMAGE_SIZE = "256x256";
// const IMAGE_SIZE = "1024x1024";

const storage = multer.diskStorage({
    destination: __dirname + `/images`,
    filename: (req, file, cb) => {
        cb(null, 'ai.png')
    }
});

const upload = multer({
    storage: storage,
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg|jpeg)$/)) {
            cb(new Error('Please upload an image.'))
        }
        cb(undefined, true)
    }
});

app.post("/alter_image", upload.single('upload'), async (req, res) => {
    try {
        await sharp(__dirname + '/images/ai.png')
            .resize(500, 500)
            .toFormat('png')
            .toFile(__dirname + '/images/output.png')

        const compressedFileSize = fs.statSync(__dirname + "/images/output.png").size
        if (compressedFileSize >= 3_900_000) throw new Error("File size is too big, please try it again with a file that is less than 4MB")

        const response = await openai.createImageVariation(
            // fs.createReadStream(__dirname + "/images/ai.png"),
            fs.createReadStream(__dirname + "/images/output.png"),
            MAX_NUMBER,
            IMAGE_SIZE
        )
        fs.unlinkSync(__dirname + "/images/ai.png");
        fs.unlinkSync(__dirname + "/images/output.png");
        res.status(200).json({ res: response.data.data });

    } catch (error) {
        if (error.response) {
            console.log(error.response.data);
            res.status(500).json({ message: error.response.data })
            console.log(error.response.status);
            res.status(500).json({ message: error.response.status })
        } else {
            console.log(error.message);
            res.status(500).json({ message: error.message })
        }
    }
})

app.post("/message", (req, res) => {
    const response = openai.createCompletion({
        model: "text-davinci-003",
        prompt: req.body.prompt,
        temperature: 0,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        max_tokens: 1024
    })
    response.then(data => {
        res.send({ message: data.data.choices[0].text })
    })
})

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
    }
})

app.listen(process.env.PORT, () => {
    console.log(`App is spinning on port ${process.env.PORT}`)
})