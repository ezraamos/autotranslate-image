const Konva = require("konva/cmj").default;
import { loadImage, registerFont } from "canvas";
import { writeFileSync } from "fs";
import fetch from "node-fetch";

registerFont("LaffayetteComicPro.ttf", { family: "Laffayette Comic Pro" });
registerFont("umeboshi.ttf", { family: "umeboshi" });
registerFont("IBM.ttf", { family: "IBM" });
registerFont("zcool.ttf", { family: "zcool" });
registerFont("akshar.ttf", { family: "akshar" });

const OCR_URL = ''
// OCR URL FROM GOOGLE API

const TRANSLATE_URL = ''
// TRANSLATE URL FROM GOOGLE API

function buildRequest(base64: any) {
  return `{
  "requests": [
    {
      "image": {
        "content": "${base64}"
      },
      "features": [
        {
          "type": "DOCUMENT_TEXT_DETECTION"
        },
      ],
    }
  ]
}
`;
}

function buildTranslateRequest(text: any) {
  return `{
  "q": "${text}",
  "target": "ja",
  "format": "text",
}`;
}
const layer = new Konva.Layer();

export async function translate(text: any) {
  const response = await fetch(TRANSLATE_URL, {
    method: "POST",
    body: buildTranslateRequest(text),
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}

export async function requestOcr(stage: any) {
  // Send the base64 image to Google OCR API
  const dataUrl = stage.toDataURL({ mimeType: "image/jpeg" });
  const base64 = dataUrl.substring(dataUrl.indexOf(",") + 1);
  const response = await fetch(OCR_URL, {
    method: "POST",
    body: buildRequest(base64),
    headers: { "Content-Type": "application/json" },
  });
  return await response.json();
}

export function toRect(boundingPoly: any) {
  function helper(axis: any, func: any) {
    let result = boundingPoly.vertices[0][axis];
    for (let i = 1; i < 4; i++) {
      const current = boundingPoly.vertices[i][axis];
      result = func(result, current);
    }
    return result;
  }

  const minX = helper("x", Math.min);
  const minY = helper("y", Math.min);
  const maxX = helper("x", Math.max);
  const maxY = helper("y", Math.max);

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function extractText(block: any) {
  let result = "";
  for (const paragraph of block.paragraphs) {
    for (const word of paragraph.words) {
      for (const symbol of word.symbols) {
        result += symbol.text;
      }
    }
  }
  return result;
}

const cleanBaseImage = (blocks: any) => {
  for (const block of blocks) {
    const rect = toRect(block.boundingBox);
    const whiteRect = new Konva.Rect({ ...rect, fill: "white" });
    layer.add(whiteRect);
  }
};

loadImage(
  "https://cdn-dev.epico.ink/public/V775ZZ/en/KDLX6I/ogg4sudy7h136c19rx9e5e581670335958770.jpg"
).then((image) => {
  const stage: any = new Konva.Stage({
    width: 700,
    height: 700 / (image.width / image.height),
  });

  const comicPage = new Konva.Image({
    x: 0,
    y: 0,
    image,
    width: 700,
    height: 700 / (image.width / image.height),
  });
  layer.add(comicPage);
  stage.add(layer);

  requestOcr(stage).then((json) => {
    const blocks = json.responses[0].fullTextAnnotation.pages[0].blocks;
    let iterations = blocks.length;

    cleanBaseImage(blocks);
    for (const block of blocks) {
      const originalText = extractText(block);
      const rect = toRect(block.boundingBox);
      translate(originalText).then((json) => {
        const translatedVersion: string =
          json.data.translations[0].translatedText;
        const addText = new Konva.Text({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          text: translatedVersion,
          fontFamily: "umeboshi",
          fontSize: 16,
          fill: "#000",
          draggable: true,
          name: "text",
        });
        layer.add(addText);
        stage.add(layer);
        {
          if (!--iterations) {
            const img = stage.toDataURL();
            const data = img.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(data, "base64");
            writeFileSync("test.jpg", buffer);
          }
        }
      });
    }
  });
});
