const admin = require('firebase-admin');
const serviceAccount = require('../mspcollage/mspcollage-advance-2612-firebase-adminsdk-fbsvc-5204001199.json'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://mspcollage-advance-2612-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.firestore();
const rtdb = admin.database();

const padRollNumber = (rollNo) => {
  return String(rollNo).padStart(6, '0');
};

const getRandomBase = () => {
  return Math.floor(100000 + Math.random() * 800000);
};

async function migrateRollNumbers() {
  console.log('Starting total roll number re-assignment...');

  // --- Re-assign Realtime Database 'players' ---
  console.log('Re-assigning RTDB players...');
  const playersRef = rtdb.ref('players');
  const playersSnapshot = await playersRef.once('value');
  const playersData = playersSnapshot.val();

  // Map to store new roll numbers for Firestore migration later
  // Structure: { classId: { oldRollNo: newRollNo } }
  const rollNoMap = {};

  if (playersData) {
    for (const classId in playersData) {
      if (playersData.hasOwnProperty(classId)) {
        console.log(`Processing class: ${classId}`);
        const classPlayers = playersData[classId];
        const oldRollNos = Object.keys(classPlayers).sort();
        
        let currentRollNo = getRandomBase();
        rollNoMap[classId] = {};

        // Store new data in memory first
        const newClassData = {};
        for (const oldRollNo of oldRollNos) {
          const player = classPlayers[oldRollNo];
          const newRollNo = padRollNumber(currentRollNo);
          
          rollNoMap[classId][oldRollNo] = newRollNo;
          newClassData[newRollNo] = {
            ...player,
            classId: classId,
            rollNo: newRollNo // Ensure it's stored inside too
          };
          
          console.log(`RTDB: ${player.name} | ${oldRollNo} -> ${newRollNo}`);
          currentRollNo++;
        }

        // Completely clear the class node first to remove all old (e.g. 3-digit) roll numbers
        console.log(`Clearing old roll numbers for class ${classId}...`);
        await rtdb.ref(`players/${classId}`).remove();

        // Write the fresh 6-digit roll numbers
        console.log(`Writing new 6-digit roll numbers for class ${classId}...`);
        await rtdb.ref(`players/${classId}`).set(newClassData);
      }
    }
  }
  console.log('RTDB re-assignment complete.');

  // --- Re-assign Firestore 'students' collection ---
  console.log('Re-assigning Firestore students...');
  const studentsCollectionRef = db.collection('students');
  const studentsSnapshot = await studentsCollectionRef.get();

  const batch = db.batch();
  let changesMade = 0;

  for (const doc of studentsSnapshot.docs) {
    const studentData = doc.data();
    const oldRollNo = studentData.rollNo;
    const classId = studentData.classId;

    if (classId && oldRollNo && rollNoMap[classId] && rollNoMap[classId][oldRollNo]) {
      const newRollNo = rollNoMap[classId][oldRollNo];
      console.log(`Firestore: ${studentData.name} | ${oldRollNo} -> ${newRollNo}`);
      batch.update(doc.ref, { rollNo: newRollNo });
      changesMade++;
    } else if (classId && oldRollNo) {
      // If the student wasn't in RTDB but has a classId, 
      // we might need a fallback or just skip if we only want to sync with RTDB
      console.log(`Firestore: Skipping ${studentData.name} (not found in RTDB map for class ${classId})`);
    }
  }

  if (changesMade > 0) {
    await batch.commit();
    console.log(`Firestore students update complete. ${changesMade} documents updated.`);
  } else {
    console.log('No Firestore students updated.');
  }

  console.log('All roll number re-assignment tasks finished.');
}

migrateRollNumbers().catch(console.error);
