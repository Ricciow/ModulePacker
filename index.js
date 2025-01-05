const File = Java.type("java.io.File")
const System = Java.type("java.lang.System")
const ZipOutputStream = Java.type("java.util.zip.ZipOutputStream")
const Files = Java.type("java.nio.file.Files")
const ZipEntry = Java.type("java.util.zip.ZipEntry")
const FileOutputStream = Java.type("java.io.FileOutputStream")

const downloadFolder = System.getProperty("user.home") + "/Downloads";

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
    let sourceFolderPath = new File(`${Config.modulesFolder}`, modulename).toPath()
    let zipPath = new File(downloadFolder, `${modulename}.zip`).toPath()
    
    console.log(sourceFolderPath.resolve(modulename))

    //Find .gitignore
    let gitignore = undefined
    Files.walk(sourceFolderPath)
    .filter(path => !Files.isDirectory(path) && path.endsWith(".gitignore"))
    .forEach(path => {
        if(!gitignore) gitignore = createGitignoreRegex(sourceFolderPath , FileLib.read(path))
    })

    //Do the zipping
    let zos = new ZipOutputStream(new FileOutputStream(zipPath));
    Files.walk(sourceFolderPath)
    .filter(path => !Files.isDirectory(path))
    .forEach(path => {
        if(!gitignore?.test(path) && (!removerepo || !/\\\.git(ignore)?\\?/g.test(path))) {
            let zipEntry = new ZipEntry(new File(`${Config.modulesFolder}`).toPath().relativize(path).toString());
            zos.putNextEntry(zipEntry);
            Files.copy(path, zos);
            zos.closeEntry();
        }
    })
    zos.flush();
  zos.close();
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
}).setCommandName("zipmodule")