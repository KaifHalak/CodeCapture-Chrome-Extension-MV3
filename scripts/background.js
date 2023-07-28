
chrome.action.onClicked.addListener(async function(tab){

    // InjectScripts(tab.id)
    let injected_flag = await CheckIfScriptAlreadyInjected(tab.id)

    // true - already injected
    // flase - not injected

    if (!injected_flag){
        await InjectScripts(tab.id)
        chrome.tabs.sendMessage(tab.id,{type:"init"})
        console.log("Scripts INjected")
    }
    
})

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    switch (message.type) {
        case "get_viewport_screenshot":
            console.log("ss")
            GetViewportScreenshot().then(sendResponse)
            return true
            break;

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

function CreateNewTab(url){
    chrome.tabs.create({ url: url })
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

