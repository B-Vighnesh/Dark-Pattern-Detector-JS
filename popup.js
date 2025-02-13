document.getElementById('compareButton').addEventListener('click', async () => {
  const datasetPath = 'dataset.tsv'; // Reference to the dataset file
  try {
    // Fetch the dataset file
    const response = await fetch(chrome.runtime.getURL(datasetPath));
    if (!response.ok) {
      throw new Error('Failed to load dataset.tsv');
    }

    const fileText = await response.text();

    // Normalize the text
    const normalizeText = (text) =>
      text.toLowerCase().replace(/\s+/g, ' ').trim();

    const fileRows = fileText
      .split(/\r?\n/)
      .map(normalizeText)
      .filter((row) => row.length > 0); // Exclude empty rows

    console.log("Normalized File Rows:", fileRows); // Debugging

    // Send file rows to the content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: compareTextOnPage,
          args: [fileRows],
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            alert("Error executing content script. Check console for details.");
          } else {
            console.log("Comparison Results:", results);
            document.getElementById('result').innerText = 'Text highlighting complete!';
          }
        }
      );
    });
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('result').innerText = 'Error: Unable to load dataset.';
  }
});

// Content script logic
function compareTextOnPage(fileRows) {
  const escapeRegExp = (text) =>
    text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  const normalizeText = (text) =>
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove non-alphanumeric characters
      .replace(/\s+/g, ' ') // Collapse multiple spaces into one
      .trim();

  const highlightTextNodes = (node, fileRows, matchedRows) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const originalText = node.textContent;
      let replaced = originalText;

      fileRows.forEach((row) => {
        const escapedRow = escapeRegExp(row);
        const regex = new RegExp(`(${escapedRow})`, 'gi'); // Case-insensitive match

        if (regex.test(originalText)) {
          matchedRows.add(row); // Add matched row to the set
        }

        replaced = replaced.replace(regex, '<mark>$1</mark>');
      });

      if (replaced !== originalText) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = replaced;
        const fragment = document.createDocumentFragment();

        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }

        node.parentNode.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
      node.childNodes.forEach((child) => highlightTextNodes(child, fileRows, matchedRows));
    }
  };

  const matchedRows = new Set();
  fileRows = fileRows.map(normalizeText); // Normalize file rows for comparison
  highlightTextNodes(document.body, fileRows, matchedRows);

  if (matchedRows.size > 0) {
    alert("You are being manipulated by the host website");
  }

  return { highlighted: Array.from(matchedRows) }; // Return the rows that were processed
}
