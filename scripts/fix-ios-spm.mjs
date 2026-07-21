import fs from 'node:fs';
import path from 'node:path';

const packageSwiftPath = path.resolve('ios/App/CapApp-SPM/Package.swift');

if (!fs.existsSync(packageSwiftPath)) {
  console.warn(`Skipping iOS SPM fix; ${packageSwiftPath} does not exist.`);
  process.exit(0);
}

let source = fs.readFileSync(packageSwiftPath, 'utf8');

if (!source.includes('https://github.com/firebase/firebase-ios-sdk.git')) {
  source = source.replace(
    '        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.0"),\n',
    '        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.0"),\n' +
      '        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", exact: "12.12.1"),\n' +
      '        .package(url: "https://github.com/google/GoogleSignIn-iOS", exact: "9.0.0"),\n',
  );
}

if (!source.includes('.product(name: "FirebaseAuth", package: "firebase-ios-sdk")')) {
  source = source.replace(
    '                .product(name: "Cordova", package: "capacitor-swift-pm"),\n',
    '                .product(name: "Cordova", package: "capacitor-swift-pm"),\n' +
      '                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),\n' +
      '                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),\n',
  );
}

fs.writeFileSync(packageSwiftPath, source);
console.log('Applied iOS SPM dependencies for FirebaseAuth and GoogleSignIn.');
