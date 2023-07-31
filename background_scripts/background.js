const OCRResult = {
    img: null,
    confidence: null,
    text: null
}


var notification_ids = []

// Chrome APIs

chrome.action.onClicked.addListener(async function(tab){

    let injected_flag = await CheckIfScriptAlreadyInjected(tab.id)

    // true - already injected
    // flase - not injected

    if (!injected_flag){
        await InjectScripts(tab.id)
    }
    
})

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    switch (message.type) {
        case "get_viewport_screenshot":
            GetViewportScreenshot().then(sendResponse)
            return true
            break;

        case "create_text_noti":
            CreateTextNotification(message.msg)
            break

        case "create_ocr_result_noti":
            OCRResult.img = message.img
            OCRResult.confidence = message.confidence
            OCRResult.text = message.text
            CreateOCRResultNotification(message.confidence)
            break

        case "activate_icon":
            ActivateIcon()
            break

        case "deactivate_icon":
            DeactivateIcon()
            break

    }

})


function GetViewportScreenshot(){
    return new Promise(function(resolve,reject){

        setTimeout(function(){
            chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT,{format:"png"},function(viewport_screenshot){
                if(viewport_screenshot){resolve(viewport_screenshot)}
                
            })
        },50)

    })

}


async function InjectScripts(tabId){
    let css_files = ["content_scripts/content.css","packages/jquery.Jcrop.min.css"]
    await chrome.scripting.insertCSS({files: css_files, target: {tabId: tabId}})

    let js_files = ["packages/tesseract.min.js","packages/jquery.min.js","packages/jquery.Jcrop.min.js","content_scripts/content.js"]
    await chrome.scripting.executeScript({files: js_files, target: {tabId: tabId}})
}


function CheckIfScriptAlreadyInjected(tabId){
    return new Promise(function(resolve,reject){

        chrome.tabs.sendMessage(tabId,{type:"init"}, function(response){
            
            if (response){  // Script already injected
                resolve(true)
            } else {
                resolve(false) // Script not injected
            }
        })

    })

}


// Chrome Notifications

function CreateTextNotification(msg){

    notification_ids.forEach(function(id){
        setTimeout(function(){chrome.notifications.clear(id)},500)
    })

    notification_ids = []

    chrome.notifications.create({
        type: 'basic',
        iconUrl: '../DisplayIcons/128.png',
        title: chrome.runtime.getManifest().name,
        message: msg
    },function(id){
        notification_ids.push(id)
    })

}

function CreateOCRResultNotification(confidence){
    chrome.notifications.create({
        type: 'basic',
        iconUrl: '../DisplayIcons/128.png',
        title: "OCR Complete",
        message: `Confidence: ${confidence}
Text Copied to Clipboard`,
        buttons: [
            {title: "Compare Side by Side"}
        ],
        requireInteraction: true
      })


    
}

chrome.notifications.onButtonClicked.addListener(async function(noti_id,btn_index){
    // 0 - Open Side by Side UI

    switch(btn_index){

        case 0:
            await chrome.tabs.create({ url: "../sidebysideUI/index.html"})
            break

    }

})



function GetCurrentTabId(){
    return new Promise(function(resolve,reject){

        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs){
            resolve(tabs[0].id)
        })

    })
}


// Toggle Icons

function ActivateIcon(){
    chrome.action.setIcon({ path: "../DisplayIcons/16-blue.png"});

}

function DeactivateIcon(){
    chrome.action.setIcon({ path: "../DisplayIcons/16.png"});
}
