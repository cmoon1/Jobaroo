const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const serviceAccount = require("./cs554finalproject-53b9e-firebase-adminsdk-g4a5k-f540f6956f.json");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://cs554finalproject-53b9e.firebaseio.com",
});

const uploadImage = async (uid, newImage) => {
	const bucket = admin
		.storage()
		.bucket("gs://cs554finalproject-53b9e.appspot.com");
	const imageBuffer = Buffer.from(newImage, "base64");
	const imageByteArray = new Uint8Array(imageBuffer);
	const file = bucket.file(`profileImages/${uid}.jpg`);
	return file
		.save(imageByteArray, {
			metadata: { metadata: { firebaseStorageDownloadTokens: uuidv4() } },
		})
		.then(() => {
			return file.getSignedUrl({ action: "read", expires: "03-09-2500" });
		})
		.then((urls) => {
			const url = urls[0];
			return url;
		})
		.catch((err) => {
			console.log(`Unable to upload file ${err}`);
			throw err;
		});
};

const getUserById = async (token) => {
	try {
		let user = await admin.auth().verifyIdToken(token);
		return user.uid;
	} catch (e) {
		console.log(e);
		return null;
	}
};

const authenticate = async (req, res, next) => {
	if (req.headers.token) {
		try {
			let res = await admin.auth().verifyIdToken(req.headers.token);
			if (res) {
				next();
			}
		} catch (e) {
			return res.status(403).json({ message: "User is not authenticated" });
		}
	} else {
		return res.status(403).json({ message: "User is not authenticated" });
	}
};

const apply = async (userUid, jobUid) => {
	let jobRef = await admin.firestore().doc(`posts/${jobUid}`);

	let jobData = {};
	await jobRef.get().then((documentSnapShot) => {
		if (documentSnapShot.exists) {
			jobData = documentSnapShot.data();
		} else {
			throw "Could not find corresponding job";
		}
	});
	let currentApplicants = jobData.applicants ? jobData.applicants : [];

	let userRef = await admin.firestore().doc(`seekers/${userUid}`);

	let userData = {};
	await userRef.get().then((documentSnapShot) => {
		if (documentSnapShot.exists) {
			userData = documentSnapShot.data();
		} else {
			throw "Could not find corresponding user";
		}
	});
	let newApplication = {
		email: userData.email,
		name: userData.displayName,
		resume: userData.resume,
	};
	if (currentApplicants.findIndex((x) => x.email === userData.email) < 0) {
		currentApplicants.push(newApplication);
	}

	await jobRef.update({ applicants: currentApplicants });

	let newJob = {
		_id: jobUid,
		company: jobData.company,
		location: jobData.zip,
		email: jobData.email,
		summary: jobData.summary,
		title: jobData.title,
		url: "",
	};

	let currentApplications = userData.applications ? userData.applications : [];
	if (currentApplicants.findIndex((x) => x._id === jobUid) < 0) {
		currentApplications.push(newJob);
	}
	await userRef.update({ applications: currentApplications });

	return jobData.email;
};

module.exports = {
	uploadImage,
	authenticate,
	getUserById,
	apply,
};
