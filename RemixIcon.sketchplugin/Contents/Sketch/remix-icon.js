@import "MochaJSDelegate.js";

const sketch = require('sketch');
const UI = require('sketch/ui');

function onRun(context) {
  log("=== RemixIcon Plugin Started ===");
  const threadDictionary = NSThread.mainThread().threadDictionary();
  const identifier = "com.funkyplugins.remixicon.window";
  const delegateIdentifier = "com.funkyplugins.remixicon.delegate";

  if (threadDictionary[identifier]) {
    threadDictionary[identifier].makeKeyAndOrderFront(nil);
    return;
  }

  const scriptFolder = context.scriptURL.URLByDeletingLastPathComponent();
  const windowWidth = 600, windowHeight = 500;
  
  const webViewWindow = NSPanel.alloc().init();
  webViewWindow.setFrame_display(NSMakeRect(0, 0, windowWidth, windowHeight), true);
  
  webViewWindow.setStyleMask(NSTitledWindowMask | NSClosableWindowMask | NSTexturedBackgroundWindowMask);
  webViewWindow.setTitlebarAppearsTransparent(true);
  webViewWindow.setTitle(""); 
  webViewWindow.setBackgroundColor(NSColor.whiteColor());
  webViewWindow.setHasShadow(true);
  
  webViewWindow.becomeKeyWindow();
  webViewWindow.setLevel(NSFloatingWindowLevel);
  threadDictionary[identifier] = webViewWindow;
  COScript.currentCOScript().setShouldKeepAround_(true);

  const htmlUrl = scriptFolder.URLByAppendingPathComponent("ui.html");
  const htmlData = NSData.dataWithContentsOfURL(htmlUrl);
  const html = NSString.alloc().initWithData_encoding(htmlData, NSUTF8StringEncoding);

  const webView = WebView.alloc().initWithFrame(NSMakeRect(0, 0, windowWidth, windowHeight - 20));
  webView.setDrawsBackground(true); // Back to normal
  const windowObject = webView.windowScriptObject();

  const delegate = new MochaJSDelegate({
    "webView:runJavaScriptAlertPanelWithMessage:initiatedByFrame:": function(webView, message, frame) {
      if (message.startsWith('insert-svg:')) {
        try {
          const data = JSON.parse(message.substring(11));
          log("DEBUG: Inserting SVG for: " + data.name);
          insertSVG(data.name, data.svg);
        } catch (e) {
          log("ERROR: Failed to parse insert data: " + e);
        }
      } else if (message.startsWith('error:')) {
        UI.message("❌ " + message.substring(6));
      }
    }
  });

  threadDictionary[delegateIdentifier] = delegate;
  webView.setUIDelegate_(delegate.getClassInstance());
  webView.mainFrame().loadHTMLString_baseURL(html, scriptFolder);
  
  webViewWindow.contentView().addSubview(webView);
  webViewWindow.center();
  webViewWindow.makeKeyAndOrderFront(nil);

  const closeButton = webViewWindow.standardWindowButton(NSWindowCloseButton);
  closeButton.setCOSJSTargetFunction(function() {
    COScript.currentCOScript().setShouldKeepAround(false);
    threadDictionary.removeObjectForKey(identifier);
    threadDictionary.removeObjectForKey(delegateIdentifier);
    webViewWindow.close();
  });
  closeButton.setAction("callAction:");
}

function insertSVG(name, svgString) {
  try {
    const svgData = NSString.stringWithString(svgString).dataUsingEncoding(NSUTF8StringEncoding);
    
    // Get the currently active document
    const sketch = require('sketch');
    const document = sketch.getSelectedDocument();
    
    if (!document) {
      UI.message("❌ No active document found");
      return;
    }

    const svgImporter = MSSVGImporter.svgImporter();
    svgImporter.prepareToImportFromData(svgData);
    const svgLayer = svgImporter.importAsLayer();
    svgLayer.setName(name);

    // Add to the current page of the active document
    const nativePage = document.selectedPage.sketchObject;
    nativePage.addLayers([svgLayer]);

    // Position in center of the active view
    const canvasView = document.sketchObject.contentDrawView();
    const center = canvasView.viewCenterInAbsoluteCoordinatesForViewPort(canvasView.viewPort());
    
    svgLayer.frame().setX(center.x - svgLayer.frame().width() / 2);
    svgLayer.frame().setY(center.y - svgLayer.frame().height() / 2);

    // Select the new layer
    document.selectedLayers.clear();
    const newLayer = sketch.fromNative(svgLayer);
    newLayer.selected = true;

    UI.message("Inserted: " + name);
  } catch (e) {
    log("CRITICAL ERROR: " + e);
    UI.message("❌ Error inserting SVG");
  }
}
