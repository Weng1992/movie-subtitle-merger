import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [images, setImages] = useState([]);
  const [spacing, setSpacing] = useState(0);
  const [subtitleRatio, setSubtitleRatio] = useState(0.15);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const canvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    
    const imageUrls = files.map((file, index) => ({
      url: URL.createObjectURL(file),
      file: file,
      name: file.name,
      selectedOrder: Date.now() + index
    }));
    
    if (images.length > 0) {
      setImages([...images, ...imageUrls]);
    } else {
      setImages(imageUrls);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    e.currentTarget.classList.remove('drag-over');
    
    if (dragIndex === dropIndex) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(dragIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    setImages(newImages);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.image-item').forEach(item => {
      item.classList.remove('drag-over');
    });
  };

  const handlePreviewDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    e.currentTarget.classList.add('dragging');
  };

  const handlePreviewDragOver = (e) => {
    e.preventDefault();
    const dragItem = document.querySelector('.dragging');
    const container = document.querySelector('.preview-images-container');
    const items = [...container.querySelectorAll('.preview-image-item:not(.dragging)')];
    
    const afterElement = items.find(item => {
      const rect = item.getBoundingClientRect();
      const offset = e.clientY - rect.top - rect.height / 2;
      return offset < 0;
    });
    
    if (afterElement) {
      afterElement.classList.add('drag-over');
    }
  };

  const handlePreviewDrop = async (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = Number(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(dragIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    setImages(newImages);
    
    // 自动更新预览
    const newPreviewUrl = await generateMergedImage(newImages);
    setPreviewUrl(newPreviewUrl);
  };

  const handlePreviewDragEnd = () => {
    document.querySelectorAll('.preview-image-item').forEach(item => {
      item.classList.remove('dragging', 'drag-over');
    });
  };

  const generateMergedImage = async (imageList = images) => {
    if (imageList.length === 0) return null;

    let totalHeight = 0;
    let maxWidth = 0;
    
    const loadedImages = await Promise.all(
      imageList.map((image, index) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // 第一张图用完整高度，其他图片用字幕高度
          if (index === 0) {
            totalHeight += img.height + spacing;
          } else {
            totalHeight += (img.height * subtitleRatio) + spacing;
          }
          maxWidth = Math.max(maxWidth, img.width);
          resolve(img);
        };
        img.src = image.url;
      }))
    );

    const canvas = canvasRef.current;
    canvas.width = maxWidth;
    canvas.height = totalHeight - spacing;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let currentY = 0;
    for (let i = 0; i < loadedImages.length; i++) {
      const img = loadedImages[i];
      
      if (i === 0) {
        // 第一张图绘制完整图片
        ctx.drawImage(img, 0, currentY);
        currentY += img.height;
      } else {
        // 其他图片只绘制字幕部分
        const subtitleHeight = img.height * subtitleRatio;
        const subtitleY = img.height - subtitleHeight;
        
        ctx.drawImage(
          img,
          0, subtitleY,
          img.width, subtitleHeight,
          0, currentY,
          img.width, subtitleHeight
        );
        currentY += subtitleHeight;
      }
      
      if (i < loadedImages.length - 1) {
        currentY += spacing;
      }
    }

    return canvas.toDataURL('image/png');
  };

  const handlePreview = async () => {
    const mergedImageUrl = await generateMergedImage();
    setPreviewUrl(mergedImageUrl);
  };

  const handleDownload = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.download = '合并后的台词.png';
      link.href = previewUrl;
      link.click();
    }
  };

  // 添加删除图片的处理函数
  const handleRemoveImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
    // 如果删除后还有图片，自动更新预览
    if (newImages.length > 0 && previewUrl) {
      handlePreview();
    } else {
      setPreviewUrl(null); // 如果没有图片了，清除预览
    }
  };

  // 添加触摸事件处理
  const handleTouchStart = (e, index) => {
    // 防止页面滚动
    e.preventDefault();
    const touch = e.touches[0];
    const item = e.currentTarget;
    
    // 记录初始触摸位置
    item.dataset.touchY = touch.clientY;
    item.dataset.initialIndex = index;
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const item = e.currentTarget;
    const initialY = parseFloat(item.dataset.touchY);
    const currentY = touch.clientY;
    const deltaY = currentY - initialY;

    // 添加拖动效果
    item.style.transform = `translateY(${deltaY}px)`;
    item.style.opacity = '0.7';
  };

  const handleTouchEnd = async (e, index) => {
    const item = e.currentTarget;
    const initialIndex = parseInt(item.dataset.initialIndex);
    const finalY = e.changedTouches[0].clientY;
    const initialY = parseFloat(item.dataset.touchY);
    const deltaY = finalY - initialY;

    // 重置样式
    item.style.transform = '';
    item.style.opacity = '';

    // 计算新位置
    const itemHeight = item.offsetHeight;
    const newIndex = initialIndex + Math.round(deltaY / itemHeight);
    
    if (newIndex !== initialIndex && newIndex >= 0 && newIndex < images.length) {
      const newImages = [...images];
      const [draggedImage] = newImages.splice(initialIndex, 1);
      newImages.splice(newIndex, 0, draggedImage);
      setImages(newImages);
      
      if (previewUrl) {
        const newPreviewUrl = await generateMergedImage(newImages);
        setPreviewUrl(newPreviewUrl);
      }
    }
  };

  const handleImageClick = (image, index) => {
    setEnlargedImage({
      url: image.url,
      index: index
    });
  };

  const handleCloseEnlarged = () => {
    setEnlargedImage(null);
  };

  return (
    <div className="app">
      <h1>影视字幕拼接工具</h1>
      
      <div className="controls">
        <div className="file-input-container">
          <label className="file-input-button">
            <span className="upload-icon"></span>
            选择图片
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleImageUpload}
            />
          </label>
        </div>
        <div className="spacing-control">
          <label>图片间距: </label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={spacing}
            onChange={(e) => setSpacing(Number(e.target.value))}
          />
          <span>{spacing}px</span>
        </div>
        <div className="spacing-control">
          <label>字幕区域: </label>
          <input 
            type="range" 
            min="10" 
            max="100"
            value={subtitleRatio * 100}
            onChange={(e) => setSubtitleRatio(Number(e.target.value) / 100)}
          />
          <span>{Math.round(subtitleRatio * 100)}%</span>
        </div>
        <button 
          className="preview-button"
          onClick={handlePreview}
          disabled={images.length === 0}
        >
          预览效果
        </button>
      </div>

      {images.length > 0 && (
        <div className="images-preview">
          <h2>已上传的图片</h2>
          <div className="images-container">
            {images.map((image, index) => (
              <div 
                key={index} 
                className="image-item"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => handleTouchEnd(e, index)}
              >
                <div className="image-number">{index + 1}</div>
                <button 
                  className="remove-button"
                  onClick={() => handleRemoveImage(index)}
                  title="删除图片"
                >
                  ×
                </button>
                <img 
                  src={image.url} 
                  alt={`截图 ${index + 1}`} 
                  onClick={() => handleImageClick(image, index)}
                />
                <div className="drag-handle">拖动调整顺序</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="merge-preview">
          <h2>预览效果</h2>
          <div className="preview-images-container">
            {images.map((image, index) => (
              <div 
                key={index}
                className="preview-image-item"
                draggable
                onDragStart={(e) => handlePreviewDragStart(e, index)}
                onDragOver={handlePreviewDragOver}
                onDrop={(e) => handlePreviewDrop(e, index)}
                onDragEnd={handlePreviewDragEnd}
              >
                <div className="preview-image-number">{index + 1}</div>
                <button 
                  className="preview-remove-button"
                  onClick={() => handleRemoveImage(index)}
                  title="删除图片"
                >
                  ×
                </button>
                <div className="preview-image-wrapper">
                  <img 
                    src={image.url} 
                    alt={`预览 ${index + 1}`}
                    onClick={() => handleImageClick(image, index)}
                    style={index === 0 ? {
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      transform: 'scale(1.1)',
                      transformOrigin: 'center center'
                    } : {
                      position: 'absolute',
                      bottom: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '100%',
                      height: `${100 / subtitleRatio}%`,
                      objectFit: 'contain',
                      objectPosition: 'center bottom'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <img src={previewUrl} alt="合并预览" className="merged-preview" />
          <button 
            className="download-button"
            onClick={handleDownload}
          >
            下载图片
          </button>
        </div>
      )}

      {enlargedImage && (
        <div className="enlarged-image-overlay" onClick={handleCloseEnlarged}>
          <div className="enlarged-image-container">
            <img 
              src={enlargedImage.url} 
              alt={`放大预览 ${enlargedImage.index + 1}`}
              onClick={e => e.stopPropagation()}
            />
            <button 
              className="close-button"
              onClick={handleCloseEnlarged}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;