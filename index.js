const File = Java.type("java.io.File")
const System = Java.type("java.lang.System")
const Files = Java.type("java.nio.file.Files")
const StandardCopyOption = Java.type("java.nio.file.StandardCopyOption")

const downloadFolder = System.getProperty("user.home") + "/Downloads";

const program_7zipPath = "C:\\Program Files\\7-Zip\\"

function getModuleNames() {
    return new File(Config.modulesFolder).list()
}

function hasSlashInMiddle(string) {
    return string.indexOf('/') >= 0 && string.indexOf('/') < string.length - 1;
}

/**
 * Doesnt support negation :shrug:
 */

function createGitignoreRegex(source, gitignore) {
    source = 'root'
    const patterns = gitignore
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Ignore empty lines and comments
        .map(line => {
            let result = line
            .replace(/[.+^${}()]/g, '\\$&')
            .replace(/\//g, "\\\\")             //Convert / to \\
            .replace(/\?/g, '.');               // Convert ? to .

            if(/\/$/.test(line)) result += "*"
            else if(!/\.[^\/]+$/.test(line)) result += "[\\\\\\.]*"

            if(!/^(\/|\*\*?)/.test(line)) result = "\\\\" + result

            if(/^\//.test(line) || (!line.startsWith("**") && hasSlashInMiddle(line))) { 
                result = source + result
            }

            result = result.replace(/\*\*?/g, '.*')     // Convert * or ** to .*

            result = result.replace(/\[([^\]]*)\]/g, (match, valor) => {
                // Replace '!' with '^' inside the value of [a-z]
                const modified = valor.replace(/!/g, '^');
                return `[${modified}]`;
            });

            if(!result.startsWith(source) && !result.startsWith(".*")) result = ".*" + result

            return `${result}`;
        });

    const combinedRegex = patterns.length > 0 ? new RegExp("^(" + patterns.join('|') + ")$") : null;
    return combinedRegex;
}

function zipModule(modulename, removerepo = false) {
    modulename = getModuleNames().find(module => modulename.toLowerCase() === module.toLowerCase())

    let sourceFolderPath = new File(`${Config.modulesFolder}`, modulename).toPath()
    let zipPath = new File(downloadFolder, `${modulename}`)

    //Find .gitignore
    let gitignore = undefined
    Files.walk(sourceFolderPath)
    .filter(path => !Files.isDirectory(path) && path.endsWith(".gitignore"))
    .forEach(path => {
        if(!gitignore) gitignore = createGitignoreRegex(sourceFolderPath , FileLib.read(path))
    })

    //Delete file if it already exists
    FileLib.deleteDirectory(zipPath)

    //Make a copy of the folder taking into account gitignore
    Files.walk(sourceFolderPath)
    .filter(path => !Files.isDirectory(path))
    .forEach(path => {
        if(!gitignore?.test(path) && (!removerepo || !/\\\.git(ignore)?\\?/g.test(path))) {
            let relpath = new File(`${Config.modulesFolder}`).toPath().relativize(path).toString()
            let newFile = new File(downloadFolder, relpath)
            let newPath = newFile.toPath()
            newFile.mkdirs()
            Files.copy(path, newPath, StandardCopyOption.REPLACE_EXISTING)
        }
    })

    if (System.getProperty("os.name").toLowerCase().includes("win")) {
        if(!removerepo) {
            Files.setAttribute(new File(zipPath.toPath().toString()+"\\.git").toPath(), "dos:hidden", true);
        }
        
        //:skull:
        let zipCommand = `cmd.exe /c cd ${program_7zipPath} && 7z a ${zipPath.toPath().toString()}.zip ${zipPath.toPath().toString()}`
        java.lang.Runtime.getRuntime().exec(java.lang.String.format(zipCommand))

        //Delete packed file since it was zipped.
        FileLib.deleteDirectory(zipPath)
    }
}

register("command", (modulename, removerepo) => {
    removerepo = removerepo.toLowerCase() === 'true' ? true : false
    if (getModuleNames().every(module => modulename.toLowerCase() !== module.toLowerCase())) {
        return ChatLib.chat("&c&lModule not found.")
    }
    try {
        zipModule(modulename, removerepo);
        ChatLib.chat(`&aSuccess: &fSaved &e${modulename} &fto downloads folder${removerepo?" without repository":""}`)
    }
    catch (error) {
        ChatLib.chat(`&cFail: &fCould not save &e${modulename} &fto downloads folder`)
        console.error(error)
    }
    
}).setTabCompletions((args) => {
    let completions = []
    if(args.length == 1) completions = getModuleNames()
    if(args.length == 2) completions = ['true', 'false']
    return completions.filter(module => module.toLowerCase().startsWith(args.length ? args[args.length - 1].toLowerCase() : "")).sort()??[]
}).setCommandName("zipmodule").setAliases("packmodule")