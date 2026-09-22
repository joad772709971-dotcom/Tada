import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    firebaseConfig = {
      projectId: "gen-lang-client-0254582746",
      firestoreDatabaseId: "ai-studio-46e704b0-7071-4e96-b782-8132930c4d92"
    };
  }
} catch (configErr: any) {
  firebaseConfig = {
    projectId: "gen-lang-client-0254582746",
    firestoreDatabaseId: "ai-studio-46e704b0-7071-4e96-b782-8132930c4d92"
  };
}

if (!firebaseConfig.firestoreDatabaseId) {
  firebaseConfig.firestoreDatabaseId = "ai-studio-46e704b0-7071-4e96-b782-8132930c4d92";
}

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

const firestore = new admin.firestore.Firestore({
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId
});

async function activateUser() {
  const targetEmail = "a777503191@gmail.com";
  console.log(`🔍 Searching for user with email: ${targetEmail}...`);
  
  try {
    const usersSnap = await firestore.collection('users').get();
    let found = false;
    
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (data.email && data.email.toLowerCase() === targetEmail.toLowerCase()) {
        console.log(`📌 Found user document ID: ${doc.id}`);
        console.log(`Current data:`, JSON.stringify(data));
        
        await doc.ref.update({
          status: "active",
          role: "superadmin",
          ownerId: doc.id
        });
        
        console.log(`✅ Updated status to 'active', role to 'superadmin', ownerId to '${doc.id}'`);
        found = true;
      }
    }
    
    if (!found) {
      console.log(`⚠️ User not found in 'users' collection. Creating a default superadmin user for this email...`);
      // Use a stable, clean ID or let Firestore generate it, but since uid represents Auth ID, 
      // when they sign up we will update it. But we can pre-create it with uid "a777503191_uid" or similar.
      // Let's create with doc ID 'a777503191_superadmin'
      const newUid = "a777503191_superadmin";
      await firestore.collection('users').doc(newUid).set({
        uid: newUid,
        email: targetEmail,
        name: "عصام الحيدري (المالك)",
        role: "superadmin",
        ownerId: newUid,
        status: "active",
        businessType: "mobiles",
        createdAt: new Date().toISOString()
      });
      console.log(`✅ Created new superadmin profile document with ID '${newUid}'`);
    }
    
    console.log("\n🚀 Operation Completed Successfully!");
  } catch (error: any) {
    console.error("❌ Error during user activation:", error);
  }
}

activateUser();
