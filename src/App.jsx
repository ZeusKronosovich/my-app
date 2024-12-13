import './App.css';
import React, { useState, useEffect } from 'react';
import LoginForm from './login';
import OrderForm from './OrderForm';
import SignUpForm from './signup';
import OrdersList from './OrderList'; 
import logo from './logo.png';
import Products from './products';
import Abouts from './about';
function App() {
    const [token, setToken] = useState('');
    const [login, setLogin] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [orders, setOrders] = useState([]);
    const [showOrders, setShowOrders] = useState(false);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedLogin = localStorage.getItem('login');
        if (storedToken && storedLogin) {
            setToken(storedToken);
            setLogin(storedLogin);
            setIsLoggedIn(true);
        }
    }, []);

    const handleTokenReceived = (receivedToken, receivedLogin) => {
        setToken(receivedToken);
        setLogin(receivedLogin);
        setIsLoggedIn(true);
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('login', receivedLogin);
    };

    const handleLogout = () => {
        setToken('');
        setLogin('');
        setIsLoggedIn(false);
        localStorage.removeItem('token');
        localStorage.removeItem('login');
        window.location.reload();
    };

    const handleShowOrders = async () => {
        if (!showOrders) {
            const response = await fetch('http://localhost:8081/orders', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setOrders(data);
            } else {
                console.error('Ошибка при получении заказов');
            }
        }
        setShowOrders(!showOrders); 
    };

    return (
        <div className="App">
            <header className="header">
                <nav className="menu">
                    <ul className="menu__ul">
                        <li className="menu__li"><a className="menu__link" href="#"><Products/></a></li>
                        <li className="menu__li"><a className="menu__link" href="#"><Abouts/></a></li>
                    </ul>
                    <a className="menu__logo" href="#">BETONTRADE</a>
                    <div className="user">
                        <div className="auth_name">
                        {isLoggedIn && <p>Вы авторизованы как: {login}</p>}
                        </div>
                        {!isLoggedIn && <a className="menu__login" href="#"><SignUpForm /></a>}
                        {!isLoggedIn && (
                            <a className="menu__login" href="#">
                                <LoginForm onTokenReceived={handleTokenReceived} currentLogin={login} />
                            </a>
                        )}
                        {isLoggedIn && <button onClick={handleLogout} className="lfb">Выход</button>}
                    </div>
                </nav>
            </header>
            <div className="order-container">
                <div className='order-bar'>
                <div className='order-make'>
            <div className="order-form-wrapper">
            {isLoggedIn && <OrderForm onShowOrders={() => setShowOrders(false)} />}
            </div>
            </div>
                    <div className='order-show'>
            {isLoggedIn && (
                <button className="show-button" onClick={handleShowOrders}>
                    {showOrders ? 'Скрыть заказы' : 'Показать заказы'}
                </button>
            )}
                    </div>
                </div>
            </div>
            {showOrders && <OrdersList orders={orders} />}
            <div className="logo-container">
                    <img src={logo} alt="Логотип" className="logo" />
                </div>
            <div className="wrapper">
                <footer className="footer">
                    <div className="footer__top">
                    <div className="footer__left">
                            <a className="logo" href="#"> BETONTRADE .inc</a>
                            <div className="text"></div>
                        </div>
                        <div className="footer__right">
                            <div className="contact">Звонить по номеру</div>
                            <a className="phone" href="#">+7 (999) 000-00-00</a>
                            <div className="address"> г. Киров, ул. Кировская, д.1 </div>
                        </div>
                    </div>
                    <div className="footer__bottom">© 2024 BETONTRADE All Rights Reserved.</div>
                </footer>
            </div>
        </div>
    );
}

export default App;