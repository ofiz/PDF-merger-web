import os
import uuid
from flask import Flask, render_template, request, jsonify, send_file, session
from werkzeug.utils import secure_filename
from PyPDF2 import PdfMerger
import tempfile
import shutil
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Configuration
UPLOAD_FOLDER = 'temp_uploads'
MERGED_FOLDER = 'temp_merged'
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB per file
ALLOWED_EXTENSIONS = {'pdf'}

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MERGED_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def cleanup_old_files():
    """Clean up files older than 1 hour"""
    cutoff_time = datetime.now() - timedelta(hours=1)
    
    for folder in [UPLOAD_FOLDER, MERGED_FOLDER]:
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            if os.path.isfile(file_path):
                file_time = datetime.fromtimestamp(os.path.getctime(file_path))
                if file_time < cutoff_time:
                    try:
                        os.remove(file_path)
                    except:
                        pass

@app.route('/')
def index():
    cleanup_old_files()
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        session['uploaded_files'] = []
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({'success': False, 'message': 'No files provided'})
    
    files = request.files.getlist('files')
    uploaded_files = session.get('uploaded_files', [])
    
    for file in files:
        if file and file.filename and allowed_file(file.filename):
            # Check file size
            file.seek(0, 2)  # Seek to end of file
            file_size = file.tell()
            file.seek(0)  # Reset file pointer
            
            if file_size > MAX_FILE_SIZE:
                return jsonify({
                    'success': False, 
                    'message': f'File {file.filename} is too large. Maximum size is 50MB.'
                })
            
            filename = secure_filename(file.filename)
            unique_filename = f"{session['session_id']}_{uuid.uuid4()}_{filename}"
            file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
            
            try:
                file.save(file_path)
                uploaded_files.append({
                    'original_name': filename,
                    'stored_name': unique_filename,
                    'size': file_size
                })
            except Exception as e:
                return jsonify({
                    'success': False, 
                    'message': f'Error uploading {filename}: {str(e)}'
                })
    
    session['uploaded_files'] = uploaded_files
    return jsonify({
        'success': True, 
        'files': uploaded_files,
        'message': f'{len(files)} file(s) uploaded successfully'
    })

@app.route('/remove_file', methods=['POST'])
def remove_file():
    data = request.get_json()
    stored_name = data.get('stored_name')
    
    uploaded_files = session.get('uploaded_files', [])
    
    # Remove from session
    uploaded_files = [f for f in uploaded_files if f['stored_name'] != stored_name]
    session['uploaded_files'] = uploaded_files
    
    # Remove physical file
    file_path = os.path.join(UPLOAD_FOLDER, stored_name)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except:
        pass
    
    return jsonify({'success': True, 'files': uploaded_files})

@app.route('/merge', methods=['POST'])
def merge_pdfs():
    uploaded_files = session.get('uploaded_files', [])
    
    if len(uploaded_files) < 2:
        return jsonify({
            'success': False, 
            'message': 'Please upload at least 2 PDF files to merge'
        })
    
    try:
        merger = PdfMerger()
        
        # Add files in the order they were uploaded
        for file_info in uploaded_files:
            file_path = os.path.join(UPLOAD_FOLDER, file_info['stored_name'])
            if os.path.exists(file_path):
                merger.append(file_path)
        
        # Generate unique filename for merged PDF
        merged_filename = f"merged_{session['session_id']}_{uuid.uuid4()}.pdf"
        merged_path = os.path.join(MERGED_FOLDER, merged_filename)
        
        merger.write(merged_path)
        merger.close()
        
        return jsonify({
            'success': True,
            'download_url': f'/download/{merged_filename}',
            'message': 'PDFs merged successfully!'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error merging PDFs: {str(e)}'
        })

@app.route('/download/<filename>')
def download_file(filename):
    file_path = os.path.join(MERGED_FOLDER, filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True, download_name='merged_document.pdf')
    else:
        return "File not found", 404

@app.route('/clear', methods=['POST'])
def clear_files():
    uploaded_files = session.get('uploaded_files', [])
    
    # Remove physical files
    for file_info in uploaded_files:
        file_path = os.path.join(UPLOAD_FOLDER, file_info['stored_name'])
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass
    
    # Clear session
    session['uploaded_files'] = []
    
    return jsonify({'success': True, 'message': 'All files cleared'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)