import './App.css';
import React, { useState, useEffect } from 'react';
import LoginForm from './login';
import OrderForm from './OrderForm';
import SignUpForm from './signup';
import OrdersList from './OrderList';
import logo from './logo.png';
import AdminPanel from './AdminPanel';

function App() {
    const [token, setToken] = useState('');
    const [login, setLogin] = useState('');
    const [role, setRole] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [orders, setOrders] = useState([]);
    const [showOrders, setShowOrders] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isSeller, setIsSeller] = useState(false);
    const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
    const [showUserOrders, setShowUserOrders] = useState(false);
    const [modalState, setModalState] = useState({
        products: false,
        about: false
    });

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedLogin = localStorage.getItem('login');
        const storedRole = localStorage.getItem('role');
        if (storedToken && storedLogin && storedRole) {
            setToken(storedToken);
            setLogin(storedLogin);
            setRole(storedRole);
            setIsLoggedIn(true);
            const adminStatus = storedRole === 'admin';
            const sellerStatus = storedRole === 'seller' || storedRole === 'admin';
            setIsAdmin(adminStatus);
            setIsSeller(sellerStatus);
            
            if (adminStatus || sellerStatus) {
                setShowAdminPanel(true);
            }
        }
    }, []);

    const handleTokenReceived = (receivedToken, receivedLogin, receivedRole) => {
        setToken(receivedToken);
        setLogin(receivedLogin);
        setRole(receivedRole);
        setIsLoggedIn(true);
        const adminStatus = receivedRole === 'admin';
        const sellerStatus = receivedRole === 'seller' || receivedRole === 'admin';
        setIsAdmin(adminStatus);
        setIsSeller(sellerStatus);
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('login', receivedLogin);
        localStorage.setItem('role', receivedRole);
        
        if (adminStatus || sellerStatus) {
            setShowAdminPanel(true);
        }
    };

    const handleLogout = () => {
        setToken('');
        setLogin('');
        setRole('');
        setIsLoggedIn(false);
        setIsAdmin(false);
        setIsSeller(false);
        setShowAdminPanel(false);
        setIsOrderFormOpen(false);
        setShowOrders(false);
        setShowUserOrders(false);
        setModalState({ products: false, about: false });
        localStorage.removeItem('token');
        localStorage.removeItem('login');
        localStorage.removeItem('role');
        window.location.reload();
    };

    const handleShowOrders = async () => {
        if (!showUserOrders) {
            try {
                const response = await fetch('http://localhost:8081/orders/with-status', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setOrders(data);
                    } else {
                        setOrders([]);
                    }
                    setShowUserOrders(true);
                } else {
                    console.error('Ошибка при загрузке заказов:', response.status);
                    setOrders([]);
                }
            } catch (error) {
                console.error('Ошибка при загрузке заказов:', error);
                setOrders([]);
            }
        } else {
            setShowUserOrders(false);
        }
    };

    const handleCloseOrders = () => {
        setShowUserOrders(false);
    };

    const handleCloseAdminPanel = () => {
        setShowAdminPanel(false);
    };

    const handleOrderFormToggle = (isOpen) => {
        setIsOrderFormOpen(isOpen);
    };

    const handleModalOpen = (modalName) => {
        setModalState(prev => ({
            ...prev,
            [modalName]: true
        }));
    };

    const handleModalClose = (modalName) => {
        setModalState(prev => ({
            ...prev,
            [modalName]: false
        }));
    };

    const shouldShowOrdersButton = isLoggedIn && !isSeller && !isAdmin && !isOrderFormOpen && !showUserOrders;

    return (
        <div className="App">
            <header className="header">
                <nav className="menu">
                    <ul className="menu__ul">
                        <li className="menu__li">
                            <button 
                                onClick={() => handleModalOpen('products')}
                                className="menu-nav-button"
                            >
                                Продукты
                            </button>
                        </li>
                        <li className="menu__li">
                            <button 
                                onClick={() => handleModalOpen('about')}
                                className="menu-nav-button"
                            >
                                О нашей компании
                            </button>
                        </li>
                    </ul>
                    <a className="menu__logo" href="#">BETONTRADE</a>
                    <div className="user">
                        <div className="auth_name">
                            {isLoggedIn && <p>Вы авторизованы как: {login} ({role})</p>}
                        </div>
                        {!isLoggedIn && (
                            <div className="auth-buttons">
                                <SignUpForm />
                                <LoginForm onTokenReceived={handleTokenReceived} currentLogin={login} />
                            </div>
                        )}
                        {isLoggedIn && <button onClick={handleLogout} className="logout-button">Выход</button>}
                    </div>
                </nav>
            </header>

            <div className={`main-content ${showAdminPanel || showUserOrders ? 'admin-active' : ''}`}>
                {showAdminPanel ? (
                    <AdminPanel 
                        userRole={role} 
                        onClose={handleCloseAdminPanel}
                    />
                ) : showUserOrders ? (
                    <div className="user-orders-panel">
                        <div className="user-orders-header">
                            <h3>Мои заказы</h3>
                            <button 
                                className="close-user-orders"
                                onClick={handleCloseOrders}
                                title="Закрыть"
                            >
                                ×
                            </button>
                        </div>
                        <AdminPanel 
                            userRole={role} 
                            forceOrdersTab={true}
                            userOrders={orders}
                        />
                    </div>
                ) : (
                    <>
                        <div className="order-container">
                            <div className='order-bar'>
                                {isLoggedIn && !isSeller && !isAdmin && (
                                    <>
                                        <div className='order-make'>
                                            <OrderForm 
                                                onShowOrders={handleShowOrders} 
                                                onFormToggle={handleOrderFormToggle}
                                            />
                                        </div>
                                        {shouldShowOrdersButton && (
                                            <div className='order-show'>
                                                <button 
                                                    className="show-button" 
                                                    onClick={handleShowOrders}
                                                >
                                                    Показать заказы
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {!showAdminPanel && !isOrderFormOpen && !showUserOrders && (
                            <div className="logo-container">
                                <img src={logo} alt="Логотип" className="logo" />
                            </div>
                        )}
                    </>
                )}
            </div>

            {modalState.products && (
                <div className="products-modal-overlay">
                    <div className="products-modal-content">
                        <div className="modal-header">
                            <h3>Наша продукция</h3>
                            <button 
                                onClick={() => handleModalClose('products')}
                                className="close-modal-btn"
                            >
                                ×
                            </button>
                        </div>
                        <ProductsContent onClose={() => handleModalClose('products')} />
                    </div>
                </div>
            )}

            {modalState.about && (
                <div className="about-modal-overlay">
                    <div className="about-modal-content">
                        <div className="modal-header">
                            <h3>О нашей компании</h3>
                            <button 
                                onClick={() => handleModalClose('about')}
                                className="close-modal-btn"
                            >
                                ×
                            </button>
                        </div>
                        <AboutContent onClose={() => handleModalClose('about')} />
                    </div>
                </div>
            )}

            <div className="wrapper">
                <footer className="footer">
                    <div className="footer__top">
                        <div className="footer__left">
                            <a className="logo" href="#">BETONTRADE .inc</a>
                        </div>
                        <div className="footer__right">
                            <div className="contact">Звонить по номеру</div>
                            <a className="phone" href="#">+7 (999) 000-00-00</a>
                            <div className="address">г. Киров, ул. Кировская, д.1</div>
                        </div>
                    </div>
                    <div className="footer__bottom">© 2025 BETONTRADE All Rights Reserved.</div>
                </footer>
            </div>
        </div>
    );
}

const ProductsContent = ({ onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [productsInfo, setProductsInfo] = useState('');
    const [images, setImages] = useState([]);
    const [userRole, setUserRole] = useState('');

    const getUserRole = () => {
        try {
            const role = localStorage.getItem('role');
            return role || '';
        } catch (error) {
            console.error('Error getting role:', error);
            return '';
        }
    };

    const canEdit = userRole === 'admin' || userRole === 'seller';

    useEffect(() => {
        const role = getUserRole();
        setUserRole(role);
        loadProductsData();
    }, []);

    const loadProductsData = () => {
        try {
            const savedInfo = localStorage.getItem('productsInfo');
            const savedImages = localStorage.getItem('productsImages');
            
            if (savedInfo) {
                setProductsInfo(savedInfo);
            } else {
                setProductsInfo(`Бетон марки M50 применяется для создания подготовительного слоя перед заливкой более прочного бетона, а также для устройства бетонных подушек под бордюры и тротуары.

Бетон M100-M150 используется для создания стяжек, заливки полов, фундаментов под лёгкие постройки и других строительных работ, где не требуется высокая прочность.

Более высокие марки бетона, такие как M200-M350 применяются для строительства фундаментов, монолитных стен, плит перекрытий, балок и колонн в жилых и общественных зданиях.

Марки M400-M450 используются для возведения конструкций с высокой нагрузкой, таких как мосты, гидротехнические сооружения, банковские хранилища и другие объекты, требующие повышенной прочности и надёжности.

Наконец, бетон марки M500 применяется в строительстве особо ответственных объектов, таких как дамбы, плотины, небоскрёбы и другие конструкции, которые должны выдерживать экстремальные нагрузки и условия эксплуатации.`);
            }
            
            if (savedImages) {
                setImages(JSON.parse(savedImages));
            }
        } catch (error) {
            console.error('Error loading products data:', error);
        }
    };

    const handleEditToggle = () => {
        if (canEdit) {
            setIsEditing(!isEditing);
        }
    };

    const handleSave = () => {
        try {
            localStorage.setItem('productsInfo', productsInfo);
            localStorage.setItem('productsImages', JSON.stringify(images));
            setIsEditing(false);
            alert('Информация о продуктах сохранена!');
        } catch (error) {
            console.error('Error saving products data:', error);
            alert('Ошибка при сохранении информации');
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const newImageData = {
                    id: Date.now(),
                    src: e.target.result,
                    name: file.name,
                    description: ''
                };
                setImages(prev => [...prev, newImageData]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageDelete = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const handleImageDescriptionChange = (id, description) => {
        setImages(prev => prev.map(img => 
            img.id === id ? { ...img, description } : img
        ));
    };

    const handleCancel = () => {
        loadProductsData();
        setIsEditing(false);
    };

    return (
        <>
            {isEditing ? (
                <div className="edit-mode">
                    <h4>Редактирование информации о продуктах</h4>
                    
                    <div className="form-group">
                        <label>Информация о продуктах:</label>
                        <textarea
                            value={productsInfo}
                            onChange={(e) => setProductsInfo(e.target.value)}
                            rows="10"
                            className="info-textarea"
                        />
                    </div>

                    <div className="form-group">
                        <label>Изображения продуктов:</label>
                        <div className="images-grid">
                            {images.map((image) => (
                                <div key={image.id} className="image-item">
                                    <img 
                                        src={image.src} 
                                        alt={image.name}
                                        className="edit-image"
                                    />
                                    <div className="image-controls">
                                        <input
                                            type="text"
                                            value={image.description}
                                            onChange={(e) => handleImageDescriptionChange(image.id, e.target.value)}
                                            placeholder="Описание изображения"
                                            className="image-description"
                                        />
                                        <button 
                                            onClick={() => handleImageDelete(image.id)}
                                            className="delete-btn small"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="file-input"
                        />
                    </div>

                    <div className="form-actions">
                        <button onClick={handleSave} className="save-btn">
                            Сохранить
                        </button>
                        <button onClick={handleCancel} className="cancel-btn">
                            Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <div className="view-mode">
                    <div className="products-content">
                        {images.length > 0 && (
                            <div className="products-images">
                                {images.map((image) => (
                                    <div key={image.id} className="product-image">
                                        <img 
                                            src={image.src} 
                                            alt={image.name}
                                            className="view-image"
                                        />
                                        {image.description && (
                                            <p className="image-caption">
                                                {image.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="products-text">
                            {productsInfo.split('\n').map((paragraph, index) => (
                                <p key={index} className="info-paragraph">
                                    {paragraph}
                                </p>
                            ))}
                        </div>
                    </div>
                    
                    {canEdit && (
                        <div className="admin-controls">
                            <button onClick={handleEditToggle} className="edit-btn">
                                Редактировать информацию
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

const AboutContent = ({ onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [aboutInfo, setAboutInfo] = useState('');
    const [contactInfo, setContactInfo] = useState({
        phone: '+7 (999) 000-00-00',
        email: 'BETONTRADE@MAIL.RU',
        address: 'г. Киров, ул. Кировская, д.1'
    });
    const [images, setImages] = useState([]);
    const [userRole, setUserRole] = useState('');

    const getUserRole = () => {
        try {
            const role = localStorage.getItem('role');
            return role || '';
        } catch (error) {
            console.error('Error getting role:', error);
            return '';
        }
    };

    const canEdit = userRole === 'admin' || userRole === 'seller';

    useEffect(() => {
        const role = getUserRole();
        setUserRole(role);
        loadAboutData();
    }, []);

    const loadAboutData = () => {
        try {
            const savedInfo = localStorage.getItem('aboutInfo');
            const savedContact = localStorage.getItem('aboutContact');
            const savedImages = localStorage.getItem('aboutImages');
            
            if (savedInfo) {
                setAboutInfo(savedInfo);
            } else {
                setAboutInfo('Наша компания уже более десяти лет на рынке. Проверенное годами качество.');
            }
            
            if (savedContact) {
                setContactInfo(JSON.parse(savedContact));
            }
            
            if (savedImages) {
                setImages(JSON.parse(savedImages));
            }
        } catch (error) {
            console.error('Error loading about data:', error);
        }
    };

    const handleEditToggle = () => {
        if (canEdit) {
            setIsEditing(!isEditing);
        }
    };

    const handleSave = () => {
        try {
            localStorage.setItem('aboutInfo', aboutInfo);
            localStorage.setItem('aboutContact', JSON.stringify(contactInfo));
            localStorage.setItem('aboutImages', JSON.stringify(images));
            setIsEditing(false);
            alert('Информация о компании сохранена!');
        } catch (error) {
            console.error('Error saving about data:', error);
            alert('Ошибка при сохранении информации');
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const newImageData = {
                    id: Date.now(),
                    src: e.target.result,
                    name: file.name,
                    description: ''
                };
                setImages(prev => [...prev, newImageData]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageDelete = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const handleImageDescriptionChange = (id, description) => {
        setImages(prev => prev.map(img => 
            img.id === id ? { ...img, description } : img
        ));
    };

    const handleContactChange = (field, value) => {
        setContactInfo(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCancel = () => {
        loadAboutData();
        setIsEditing(false);
    };

    return (
        <>
            {isEditing ? (
                <div className="edit-mode">
                    <h4>Редактирование информации о компании</h4>
                    
                    <div className="form-group">
                        <label>Информация о компании:</label>
                        <textarea
                            value={aboutInfo}
                            onChange={(e) => setAboutInfo(e.target.value)}
                            rows="6"
                            className="info-textarea"
                        />
                    </div>

                    <div className="form-group">
                        <label>Контактная информация:</label>
                        <div className="contact-fields">
                            <div className="contact-field">
                                <label>Телефон:</label>
                                <input
                                    type="text"
                                    value={contactInfo.phone}
                                    onChange={(e) => handleContactChange('phone', e.target.value)}
                                    className="contact-input"
                                />
                            </div>
                            <div className="contact-field">
                                <label>Email:</label>
                                <input
                                    type="email"
                                    value={contactInfo.email}
                                    onChange={(e) => handleContactChange('email', e.target.value)}
                                    className="contact-input"
                                />
                            </div>
                            <div className="contact-field">
                                <label>Адрес:</label>
                                <input
                                    type="text"
                                    value={contactInfo.address}
                                    onChange={(e) => handleContactChange('address', e.target.value)}
                                    className="contact-input"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Изображения компании:</label>
                        <div className="images-grid">
                            {images.map((image) => (
                                <div key={image.id} className="image-item">
                                    <img 
                                        src={image.src} 
                                        alt={image.name}
                                        className="edit-image"
                                    />
                                    <div className="image-controls">
                                        <input
                                            type="text"
                                            value={image.description}
                                            onChange={(e) => handleImageDescriptionChange(image.id, e.target.value)}
                                            placeholder="Описание изображения"
                                            className="image-description"
                                        />
                                        <button 
                                            onClick={() => handleImageDelete(image.id)}
                                            className="delete-btn small"
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="file-input"
                        />
                    </div>

                    <div className="form-actions">
                        <button onClick={handleSave} className="save-btn">
                            Сохранить
                        </button>
                        <button onClick={handleCancel} className="cancel-btn">
                            Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <div className="view-mode">
                    <div className="about-content">
                        {images.length > 0 && (
                            <div className="about-images">
                                {images.map((image) => (
                                    <div key={image.id} className="about-image">
                                        <img 
                                            src={image.src} 
                                            alt={image.name}
                                            className="view-image"
                                        />
                                        {image.description && (
                                            <p className="image-caption">
                                                {image.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <div className="about-text">
                            <p className="company-description">{aboutInfo}</p>
                            
                            <div className="contact-info">
                                <div className="contact-item">
                                    <strong>Контактный номер:</strong> <i>{contactInfo.phone}</i>
                                </div>
                                <div className="contact-item">
                                    <strong>Контактный e-mail:</strong> <b>{contactInfo.email}</b>
                                </div>
                                <div className="contact-item">
                                    <strong>Адрес:</strong> {contactInfo.address}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {canEdit && (
                        <div className="admin-controls">
                            <button onClick={handleEditToggle} className="edit-btn">
                                Редактировать информацию
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default App;