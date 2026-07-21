async function main() {
  console.log("Calling /api/scan-duplicates...");
  const res = await fetch("http://localhost:3000/api/scan-duplicates");
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  
  if (data.duplicateIdsToDelete && data.duplicateIdsToDelete.length > 0) {
      console.log("Cleaning up...");
      const res2 = await fetch("http://localhost:3000/api/cleanup-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duplicateIds: data.duplicateIdsToDelete }),
      });
      const data2 = await res2.json();
      console.log("Cleanup result:", data2);
  } else {
      console.log("No duplicates to clean up.");
  }
}
main().catch(console.error);
