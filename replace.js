import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const startMarker = '          {activeView === "settings" && (';
const endMarker = '          {activeView === "user_profile" && (';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newContent = content.substring(0, startIndex) +
    `          {activeView === "settings" && (
            <SettingsView />
          )}

` + content.substring(endIndex);

  // Also need to inject import SettingsView if it is missing
  if (!newContent.includes('import { SettingsView }')) {
    const importMarker = 'import { Settings, LogOut';
    content = newContent.replace(importMarker, 'import { SettingsView } from "./pages/Settings/SettingsView";\n' + importMarker);
  }

  fs.writeFileSync('src/App.tsx', content);
  console.log("Successfully replaced settings component");
} else {
  console.log("Could not find markers", !!startIndex, !!endIndex);
}
