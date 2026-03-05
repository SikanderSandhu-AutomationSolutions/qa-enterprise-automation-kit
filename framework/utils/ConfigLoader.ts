import * as fs from 'fs';
import * as path from 'path';

export class ConfigLoader {
    static loadJson(filePath: string): any {
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Config file not found: ${absolutePath}`);
        }
        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        return JSON.parse(fileContent);
    }
}
