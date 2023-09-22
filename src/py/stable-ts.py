import os
import stable_whisper
import sys

def replace_extension(file_name, new_extension):
    base_name = os.path.splitext(file_name)[0]
    new_file_name = base_name + new_extension
    return new_file_name

def save_text_to_file(file_path, text):
    with open(file_path, 'w') as file:
        file.write(text)


filePath = sys.argv[1]
outputFilePath = replace_extension(filePath, '.json')
model = stable_whisper.load_model('base')
result = model.transcribe(filePath, regroup=True)
result.save_as_json(outputFilePath)
print(result.text.strip())