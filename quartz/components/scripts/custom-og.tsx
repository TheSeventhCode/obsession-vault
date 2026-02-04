import { SocialImageOptions } from "../../util/og"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"

export const ImageAndTitle: SocialImageOptions["imageStructure"] = ({
    cfg,
    userOpts,
    title,
    description,
    fonts,
    fileData,
}) => {
    const { colorScheme } = userOpts
    const theme = cfg.theme.colors[colorScheme]

    // 1. Setup Defaults
    const fontTitle = fonts[0]
    const fontBody = fonts[1]

    // 2. Read the RAW markdown file to find images
    // (fileData.text is plain text with markdown stripped, so we need the original file)
    let imageBase64: string | null = null
    let rawMarkdown = ""
    
    if (fileData.filePath && fs.existsSync(fileData.filePath)) {
        try {
            rawMarkdown = fs.readFileSync(fileData.filePath, 'utf-8')
        } catch (e) {
            console.error(`Error reading markdown file ${fileData.filePath}:`, e)
        }
    }

    // Regex patterns for Markdown ![alt](path) and Wikilink ![[path]]
    // First check for any Markdown image (including URLs)
    const mdImgRegexAny = /!\[.*?\]\(([^)]+)\)/
    
    // Matches Markdown images with file extensions: ![alt text](path/to/image.png)
    const mdImgRegexLocal = /!\[.*?\]\(([^)]+?\.(?:png|jpg|jpeg|webp|gif|PNG|JPG|JPEG|WEBP|GIF))(?:\s+[^)]+)?\)/i
    
    // Matches Wikilink images: ![[image.png]] or ![[image]] or ![[image.png|alt text]]
    const wikiImgRegex = /!\[\[([^|\]]+?)(?:\.(png|jpg|jpeg|webp|gif))?\s*(?:\|[^\]]+)?\]\]/i

    const mdMatchAny = rawMarkdown.match(mdImgRegexAny)
    const mdMatchLocal = rawMarkdown.match(mdImgRegexLocal)
    const wikiMatch = rawMarkdown.match(wikiImgRegex)

    // Determine the image path
    let foundImagePath = ""
    let isExternalUrl = false
    let hasExtension = true

    if (mdMatchAny) {
        foundImagePath = mdMatchAny[1]
        // Check if it's an external URL
        if (foundImagePath.startsWith('http://') || foundImagePath.startsWith('https://')) {
            isExternalUrl = true
        } else if (mdMatchLocal) {
            // It's a local file with extension
            foundImagePath = mdMatchLocal[1]
        }
    } else if (wikiMatch) {
        foundImagePath = wikiMatch[1]
        // If extension was captured in the regex, add it back
        if (wikiMatch[2]) {
            foundImagePath += `.${wikiMatch[2]}`
        } else {
            hasExtension = false
        }
    }

    // Helper function to resize image using sharp via subprocess (since sharp is async)
    const resizeImage = (inputPath: string): Buffer | null => {
        try {
            const tempOut = `/tmp/og-img-${Date.now()}-out.png`
            
            // Use node to run sharp resize synchronously via subprocess
            const resizeScript = `
                const sharp = require('sharp');
                sharp('${inputPath}')
                    .resize(800, null, { withoutEnlargement: true })
                    .png({ quality: 80 })
                    .toFile('${tempOut}')
                    .then(() => process.exit(0))
                    .catch((e) => { console.error(e); process.exit(1); });
            `
            
            execSync(`node -e "${resizeScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, {
                cwd: process.cwd(),
                timeout: 30000,
                stdio: 'pipe',
            })
            
            if (fs.existsSync(tempOut)) {
                const buffer = fs.readFileSync(tempOut)
                fs.unlinkSync(tempOut)
                return buffer
            }
            return null
        } catch (e) {
            return null
        }
    }

    // 3. Load the image (from URL or disk)
    if (foundImagePath && isExternalUrl) {
        // Fetch external image synchronously using curl
        try {
            console.log(`Fetching external OG image for ${fileData.slug}: ${foundImagePath}`)
            
            // Download to temp file
            const tempIn = `/tmp/og-img-${Date.now()}-download`
            execSync(`curl -sL -o "${tempIn}" "${foundImagePath}"`, {
                timeout: 30000,
            })
            
            if (fs.existsSync(tempIn)) {
                const originalSize = fs.statSync(tempIn).size
                
                // Resize the image
                const resizedBuffer = resizeImage(tempIn)
                
                // Clean up temp download
                fs.unlinkSync(tempIn)
                
                if (resizedBuffer) {
                    imageBase64 = `data:image/png;base64,${resizedBuffer.toString('base64')}`
                    console.log(`✓ External OG image loaded for ${fileData.slug} (${(originalSize / 1024).toFixed(1)}KB → ${(resizedBuffer.length / 1024).toFixed(1)}KB)`)
                } else {
                    console.error(`Failed to resize external image for ${fileData.slug}`)
                }
            }
        } catch (e) {
            console.error(`Error fetching external OG image from ${foundImagePath}:`, e)
        }
    } else if (foundImagePath) {
        // Clean up the path (remove query params, anchors, decode URI)
        const cleanPath = decodeURIComponent(foundImagePath.split('?')[0].split('#')[0].trim())

        // Try to resolve path relative to the current file, or from content root
        // Note: Quartz fileData.filePath is the absolute path to the .md file
        const contentDir = path.resolve(process.cwd(), "content")
        const dirOfCurrentNote = fileData.filePath ? path.dirname(fileData.filePath) : contentDir

        // Common Obsidian attachment folder names
        const attachmentFolders = ["attachments", "Attachments", "assets", "Assets", "images", "Images", "files", "Files"]
        
        // Build list of potential paths to check
        let potentialPaths: string[] = []

        // If no extension, try all common image extensions
        const extensionsToTry = hasExtension ? [""] : [".png", ".jpg", ".jpeg", ".webp", ".gif"]
        
        for (const ext of extensionsToTry) {
            const pathWithExt = cleanPath + ext
            
            // 1. Relative to current note
            potentialPaths.push(path.resolve(dirOfCurrentNote, pathWithExt))
            
            // 2. Relative to content root
            potentialPaths.push(path.resolve(contentDir, pathWithExt))
            
            // 3. In common attachment folders relative to current note
            for (const folder of attachmentFolders) {
                potentialPaths.push(path.resolve(dirOfCurrentNote, folder, pathWithExt))
            }
            
            // 4. In common attachment folders relative to content root
            for (const folder of attachmentFolders) {
                potentialPaths.push(path.resolve(contentDir, folder, pathWithExt))
            }
            
            // 5. Just the filename in current directory (in case path includes subdirs that don't exist)
            const filename = path.basename(pathWithExt)
            potentialPaths.push(path.resolve(dirOfCurrentNote, filename))
            
            // 6. Just the filename in attachment folders
            for (const folder of attachmentFolders) {
                potentialPaths.push(path.resolve(dirOfCurrentNote, folder, filename))
                potentialPaths.push(path.resolve(contentDir, folder, filename))
            }
        }

        // Try each potential path
        for (const p of potentialPaths) {
            if (fs.existsSync(p)) {
                try {
                    const originalSize = fs.statSync(p).size
                    
                    // Resize the image
                    const resizedBuffer = resizeImage(p)
                    
                    if (resizedBuffer) {
                        imageBase64 = `data:image/png;base64,${resizedBuffer.toString("base64")}`
                        console.log(`✓ OG Image found for ${fileData.slug}: ${p} (${(originalSize / 1024).toFixed(1)}KB → ${(resizedBuffer.length / 1024).toFixed(1)}KB)`)
                    } else {
                        // Fallback to original if resize fails
                        const fileBuffer = fs.readFileSync(p)
                        const ext = path.extname(p).substring(1).toLowerCase()
                        const mimeExt = ext === "jpeg" ? "jpg" : ext
                        imageBase64 = `data:image/${mimeExt};base64,${fileBuffer.toString("base64")}`
                        console.log(`✓ OG Image found for ${fileData.slug}: ${p} (original, no resize)`)
                    }
                    break
                } catch (e) {
                    console.error(`Error reading OG image from ${p}:`, e)
                }
            }
        }
        
        if (!imageBase64) {
            console.log(`✗ OG Image not found for ${fileData.slug}. Searched path: ${cleanPath}`)
        }
    }

    // 4. Define Styles
    // If we found an image, we use a split layout. If not, we default to centered text.
    const hasImage = imageBase64 !== null

    return (
        <div
            style={{
                display: "flex",
                height: "100%",
                width: "100%",
                backgroundColor: theme.light,
                fontFamily: fontTitle.name,
            }}
        >
            {/* Left Side: Text */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "4rem",
                    width: hasImage ? "60%" : "100%", // Take full width if no image
                    height: "100%",
                    gap: "1rem",
                }}
            >
                <h1
                    style={{
                        fontSize: hasImage ? "64px" : "80px", // Slightly smaller text if split
                        fontWeight: 700,
                        color: theme.dark,
                        margin: 0,
                        lineHeight: 1.1,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                    }}
                >
                    {title}
                </h1>
                <p
                    style={{
                        fontSize: "32px",
                        color: theme.gray,
                        fontFamily: fontBody.name,
                        lineHeight: 1.4,
                        margin: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: hasImage ? 3 : 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {description}
                </p>
            </div>

            {/* Right Side: Image (Only if found) */}
            {hasImage && (
                <div
                    style={{
                        display: "flex",
                        width: "40%",
                        height: "100%",
                        backgroundColor: theme.lightgray,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                    }}
                >
                    <img
                        src={imageBase64!}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                </div>
            )}
        </div>
    )
}