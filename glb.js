const fs = require('fs');
const GLB_FILE = fs.readFileSync(process.argv[2]);
const RAW_GLB_FILENAME = process.argv[2].replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, "");
const BUFFERS_PATH = `./${RAW_GLB_FILENAME}_buffers`;

function setPadding(buf) {
    let padAmount = buf.length % 16;
    padAmount = padAmount != 0 ? 16 - padAmount : padAmount;
    return padAmount != 0 ? Buffer.concat([buf, Buffer.alloc(padAmount)]) : buf;
}

if (!fs.existsSync(BUFFERS_PATH)) fs.mkdirSync(BUFFERS_PATH);

let offset = 20;
let glbJsonLength = GLB_FILE.slice(12, 14).readUInt16LE();
let glbJson = JSON.parse(GLB_FILE.slice(offset, offset + glbJsonLength).toString());
offset += glbJsonLength + 8;
let glbData = GLB_FILE.slice(offset, GLB_FILE.length);

let primitives = ((glbJson["meshes"])[0])["primitives"];
let accessors = glbJson["accessors"];
let bufferViews = glbJson["bufferViews"];
let buffers = [];
let bufferCounts = [];
for (let i = 0; i < bufferViews.length; ++i) {
	let bufView = bufferViews[i];
	let byteOffset = bufView["byteOffset"];
	let byteLength = bufView["byteLength"];
	let buf = glbData.slice(byteOffset, byteOffset + byteLength);
	buffers.push(buf);
	let accessor = accessors[i];
	let count = accessor["count"];
	bufferCounts.push(count);
}
let positions = [];
let uvs = [];
let faces = [];
for (let i = 0; i < primitives.length; ++i) {
	let primitive = primitives[i];
	let attributes = primitive["attributes"];
	let posBufIndex = attributes["POSITION"];
	let positionBuffer = buffers[posBufIndex];
	let normBufIndex = attributes["NORMAL"];
	let normalBuffer = buffers[normBufIndex];
	let uvsBufIndex = attributes["TEXCOORD_0"];
	let uvsBuffer = buffers[uvsBufIndex];
	let facesBufIndex = uvsBufIndex + 1;
	let facesBuffer = buffers[facesBufIndex];
	let modPositionBuffer = [];
	offset = 0;
	for (let i = 0; i < bufferCounts[posBufIndex]; ++i) {
		let posX = positionBuffer.slice(offset, offset + 4);
		let normBuf = Buffer.alloc(4);
		let normXVal = normalBuffer.slice(offset, offset + 4).readUInt16LE();
		normBuf.writeUInt16LE(normXVal);
		offset += 4;
		let posZ = positionBuffer.slice(offset, offset + 4);
		let normYVal = normalBuffer.slice(offset, offset + 4).readUInt16LE();
		normBuf.writeUInt16LE(normYVal, 0x02);
		offset += 4;
		let posY = positionBuffer.slice(offset, offset + 4);
		offset += 4;
		modPositionBuffer.push(posX);
		modPositionBuffer.push(posY);
		modPositionBuffer.push(posZ);
		modPositionBuffer.push(Buffer.concat([normBuf, Buffer.from([0xFF, 0x7F, 0xFF, 0x7F])])); // temp
	}
	modPositionBuffer = Buffer.concat(modPositionBuffer);
	positions.push(modPositionBuffer);
	uvs.push(uvsBuffer);
	faces.push(facesBuffer);
	fs.writeFileSync(`${BUFFERS_PATH}/${i + 1}_positions`, positionBuffer);
	fs.writeFileSync(`${BUFFERS_PATH}/${i + 1}_normals`, normalBuffer);
	fs.writeFileSync(`${BUFFERS_PATH}/${i + 1}_uvs`, uvsBuffer);
	fs.writeFileSync(`${BUFFERS_PATH}/${i + 1}_faces`, facesBuffer);
}
positions = setPadding(Buffer.concat(positions));
uvs = setPadding(Buffer.concat(uvs));
faces = setPadding(Buffer.concat(faces));
let output = Buffer.concat([faces, positions, uvs]);
fs.writeFileSync(`./${RAW_GLB_FILENAME}_o`, output);