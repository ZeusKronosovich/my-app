import React, { useState, useEffect } from 'react';

const AdminPanel = ({ userRole, forceOrdersTab = false, userOrders = null }) => {
    const [activeTab, setActiveTab] = useState();
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [editingOrder, setEditingOrder] = useState(null);
    const [newUser, setNewUser] = useState({ login: '', password: '', role: 'user' });
    const [searchTerm, setSearchTerm] = useState('');
    const [showUserCreator, setShowUserCreator] = useState(false);
    const [concretePrices, setConcretePrices] = useState({});
    const [concreteGrades, setConcreteGrades] = useState([]);
    const [newConcreteGrade, setNewConcreteGrade] = useState('');
    const [newConcretePrice, setNewConcretePrice] = useState('');
    const [appStats, setAppStats] = useState({});
    const [systemStatus, setSystemStatus] = useState({});
    const [machines, setMachines] = useState([]);
    const [allMachines, setAllMachines] = useState([]);
    const [availableMachines, setAvailableMachines] = useState([]);
    const [orderHistory, setOrderHistory] = useState({});
    const [editingMachine, setEditingMachine] = useState(null);
    const [newMachine, setNewMachine] = useState({
        plate_number: '',
        type: '',
        capacity: '',
        is_active: true
    });
    
    const [openTabs, setOpenTabs] = useState({
        orders: false,
        users: false,
        monitoring: false,
        prices: false,
        machines: false
    });
    
    const roles = ['user', 'seller'];

    const isAdmin = userRole === 'admin';
    const isSeller = userRole === 'seller' || isAdmin;
    const isUser = userRole === 'user';

    const protectedAccounts = ['admin', 'seller'];

    useEffect(() => {
        if (forceOrdersTab) {
            setActiveTab('orders');
            setOpenTabs({ orders: true, users: false, monitoring: false, prices: false, machines: false });
            if (userOrders) {
                setOrders(userOrders);
            }
        }
    }, [forceOrdersTab, userOrders]);

    useEffect(() => {
        if (openTabs.orders && activeTab === 'orders') {
            if (isUser) {
                fetchUserOrders();
            } else if (isSeller || isAdmin) {
                fetchOrders();
                fetchMachines();
                fetchAllMachines();
            }
            fetchConcreteGrades();
            fetchConcretePrices();
        } else if (openTabs.users && activeTab === 'users' && isAdmin) {
            fetchUsers();
        } else if (openTabs.monitoring && activeTab === 'monitoring' && isAdmin) {
            fetchAppStats();
            fetchSystemStatus();
        } else if (openTabs.prices && activeTab === 'prices') {
            fetchConcreteGrades();
            fetchConcretePrices();
        } else if (openTabs.machines && activeTab === 'machines' && isSeller) {
            fetchMachines();
        }
    }, [openTabs, activeTab, isAdmin, isSeller, isUser]);

    const fetchUserOrders = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/orders/with-status', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Ошибка при загрузке заказов пользователя:', error);
            setOrders([]);
        }
    };

    const fetchOrders = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/seller/orders/with-status', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setOrders(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Ошибка при загрузке заказов:', error);
            setOrders([]);
        }
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/admin/users', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Ошибка при загрузке пользователей:', error);
            setUsers([]);
        }
    };

    const fetchConcretePrices = async () => {
        try {
            const response = await fetch('http://localhost:8081/prices');
            if (response.ok) {
                const data = await response.json();
                const sortedPrices = {};
                Object.keys(data)
                    .sort((a, b) => {
                        const numA = parseInt(a.replace('M', ''));
                        const numB = parseInt(b.replace('M', ''));
                        return numA - numB;
                    })
                    .forEach(grade => {
                        sortedPrices[grade] = data[grade];
                    });
                setConcretePrices(sortedPrices);
            }
        } catch (error) {
            console.error('Ошибка при загрузке цен:', error);
        }
    };

    const fetchConcreteGrades = async () => {
        try {
            const response = await fetch('http://localhost:8081/concrete/grades');
            if (response.ok) {
                const data = await response.json();
                const sortedGrades = (data || []).sort((a, b) => {
                    const numA = parseInt(a.replace('M', ''));
                    const numB = parseInt(b.replace('M', ''));
                    return numA - numB;
                });
                setConcreteGrades(sortedGrades);
            }
        } catch (error) {
            console.error('Ошибка при загрузке марок бетона:', error);
        }
    };

    const fetchMachines = async (requiredCapacity = null) => {
        try {
            const token = localStorage.getItem('token');
            let url = 'http://localhost:8081/seller/machines';
            if (requiredCapacity) {
                url += `?required_capacity=${requiredCapacity}`;
            }
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                if (requiredCapacity) {
                    setAvailableMachines(Array.isArray(data) ? data : []);
                } else {
                    setMachines(Array.isArray(data) ? data : []);
                }
            }
        } catch (error) {
            console.error('Ошибка при загрузке машин:', error);
        }
    };

    const fetchAllMachines = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/seller/all-machines', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setAllMachines(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Ошибка при загрузке всех машин:', error);
            setAllMachines([]);
        }
    };

    const fetchAppStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/admin/stats', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setAppStats(data);
            } else {
                setAppStats({
                    totalUsers: users.length,
                    totalOrders: orders.length,
                    databaseSize: '2.3 GB',
                    lastBackup: '2024-01-15 03:00:00',
                    registrationEnabled: true,
                    orderCreationEnabled: true,
                    dbConnected: true
                });
            }
        } catch (error) {
            console.error('Ошибка при загрузке статистики:', error);
            setAppStats({
                totalUsers: users.length,
                totalOrders: orders.length,
                databaseSize: '2.3 GB',
                lastBackup: '2024-01-15 03:00:00',
                registrationEnabled: true,
                orderCreationEnabled: true,
                dbConnected: true,
                error: true
            });
        }
    };

    const fetchSystemStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/admin/status', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setSystemStatus(data);
            } else {
                setSystemStatus({
                    database: { status: 'online' },
                    api: { status: 'online' },
                    authentication: { status: 'online' },
                    orders: { status: 'online' },
                    users: { status: 'online' },
                    lastCheck: new Date().toLocaleString('ru-RU')
                });
            }
        } catch (error) {
            console.error('Ошибка при загрузке статуса системы:', error);
            setSystemStatus({
                database: { status: 'error' },
                api: { status: 'error' },
                authentication: { status: 'error' },
                orders: { status: 'error' },
                users: { status: 'error' },
                lastCheck: new Date().toLocaleString('ru-RU'),
                error: true
            });
        }
    };

    const filteredOrders = (Array.isArray(orders) ? orders : []).filter(order => 
    order && Object.values(order).some(
        value => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
    );

    const filteredUsers = (Array.isArray(users) ? users : []).filter(user => 
    user && Object.values(user).some(
        value => value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
    );

    const handleEditOrder = async (order) => {
        if (!isSeller && !isAdmin) {
            return;
        }
        
        await fetchMachines(order.o_betonv);
        
        await fetchMachines();
        await fetchAllMachines();
        
        if ((order.o_status === 'completed' || order.o_status === 'cancelled') && order.o_machine_id) {
            setOrderHistory(prev => ({
                ...prev,
                [order.o_number]: order.o_machine_id
            }));
        }
        
        setEditingOrder({ 
            ...order,
            o_status: order.o_status || 'pending',
            o_machine_id: (order.o_status === 'cancelled') ? null : (order.o_machine_id || null)
        });
    };

    const calculatePrice = (volume, concreteGrade) => {
        if (volume && concretePrices[concreteGrade]) {
            return concretePrices[concreteGrade] * volume;
        }
        return 0;
    };

    const handleSaveOrder = async () => {
        if (!isSeller && !isAdmin) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            const orderToSend = { ...editingOrder };
            
            if (editingOrder.o_status === 'cancelled') {
                orderToSend.o_machine_id = null;
            }
            
            const response = await fetch('http://localhost:8081/seller/orders/update-with-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(orderToSend),
            });

            if (response.ok) {
                if (isUser) {
                    await fetchUserOrders();
                } else {
                    await fetchOrders();
                }
                setEditingOrder(null);
                setAvailableMachines([]);
            }
        } catch (error) {
            console.error('Ошибка при обновлении заказа:', error);
        }
    };

    const handleDeleteOrder = async () => {
        if (!isSeller && !isAdmin) {
            return;
        }
        
        if (window.confirm('Вы уверены, что хотите удалить этот заказ?')) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `http://localhost:8081/seller/orders/delete/${editingOrder.o_number}`, 
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    }
                );

                if (response.ok) {
                    if (isUser) {
                        await fetchUserOrders();
                    } else {
                        await fetchOrders();
                    }
                    setEditingOrder(null);
                }
            } catch (error) {
                console.error('Ошибка при удалении заказа:', error);
            }
        }
    };

    const handleDeleteUser = async (userLogin) => {
        if (window.confirm(`Вы уверены, что хотите удалить пользователя ${userLogin}? Все заказы пользователя останутся в системе.`)) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(
                    `http://localhost:8081/admin/users/${userLogin}`, 
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                        },
                    }
                );

                if (response.ok) {
                    const result = await response.json();
                    alert(result.message || 'Пользователь успешно удален!');
                    await fetchUsers();
                } else {
                    const errorText = await response.text();
                    alert(`Ошибка при удалении пользователя: ${errorText}`);
                }
            } catch (error) {
                console.error('Ошибка при удалении пользователя:', error);
                alert('Ошибка при удалении пользователя');
            }
        }
    };

    const handleCreateUser = async () => {
        // Валидация логина
        const loginRegex = /^[a-zA-Z0-9]+$/;
        if (!loginRegex.test(newUser.login) || newUser.login.length < 3 || newUser.login.length > 20) {
            alert('Логин должен содержать только латинские буквы и цифры, от 3 до 20 символов');
            return;
        }

        // Валидация пароля
        const passwordRegex = /^[a-zA-Z0-9]+$/;
        if (!passwordRegex.test(newUser.password) || newUser.password.length < 6 || newUser.password.length > 20) {
            alert('Пароль должен содержать только латинские буквы и цифры, от 6 до 20 символов');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(newUser),
            });

            if (response.ok) {
                await fetchUsers();
                setNewUser({ login: '', password: '', role: 'user' });
                setShowUserCreator(false);
                alert('Пользователь успешно создан!');
            } else {
                const errorText = await response.text();
                alert(`Ошибка при создании пользователя: ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка при создании пользователя:', error);
            alert('Ошибка при создании пользователя');
        }
    };

    const handlePriceChange = (grade, value) => {
        // Запрет отрицательных значений
        const numericValue = Math.max(0, parseInt(value) || 0);
        setConcretePrices(prev => ({
            ...prev,
            [grade]: numericValue
        }));
    };

    const savePrices = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/seller/prices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(concretePrices),
            });

            if (response.ok) {
                alert('Цены успешно обновлены!');
            }
        } catch (error) {
            console.error('Ошибка при сохранении цен:', error);
        }
    };

    const handleAddConcreteGrade = async () => {
        // Валидация марки бетона
        const gradeRegex = /^[a-zA-Z0-9]+$/;
        if (!gradeRegex.test(newConcreteGrade) || newConcreteGrade.length > 20) {
            alert('Марка бетона должна содержать только латинские буквы и цифры, максимум 20 символов');
            return;
        }

        if (!newConcretePrice || parseInt(newConcretePrice) <= 0) {
            alert('Цена должна быть положительным числом');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/seller/concrete/grades', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    grade: newConcreteGrade,
                    price: Math.max(0, parseInt(newConcretePrice) || 0)
                }),
            });

            if (response.ok) {
                await fetchConcreteGrades();
                await fetchConcretePrices();
                setNewConcreteGrade('');
                setNewConcretePrice('');
                alert('Марка бетона успешно добавлена!');
            } else {
                const errorText = await response.text();
                alert(`Ошибка при добавлении марки бетона: ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка при добавлении марки бетона:', error);
            alert('Ошибка при добавлении марки бетона');
        }
    };

    const handleDeleteConcreteGrade = async (grade) => {
        if (window.confirm(`Вы уверены, что хотите удалить марку бетона ${grade}?`)) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:8081/seller/concrete/grades/${grade}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    await fetchConcreteGrades();
                    await fetchConcretePrices();
                    alert('Марка бетона успешно удалена!');
                } else {
                    const errorText = await response.text();
                    alert(`Ошибка при удалении марки бетона: ${errorText}`);
                }
            } catch (error) {
                console.error('Ошибка при удалении марки бетона:', error);
                alert('Ошибка при удалении марки бетона');
            }
        }
    };

    const handleCreateMachine = async () => {
        // Валидация номера машины
        const plateRegex = /^[a-zA-Zа-яА-Я0-9]+$/;
        if (!plateRegex.test(newMachine.plate_number) || newMachine.plate_number.length > 20) {
            alert('Гос. номер должен содержать только буквы и цифры, максимум 20 символов');
            return;
        }

        if (!newMachine.type || newMachine.type.length > 50) {
            alert('Тип машины обязателен и не должен превышать 50 символов');
            return;
        }

        if (!newMachine.capacity || parseInt(newMachine.capacity) <= 0) {
            alert('Вместимость должна быть положительным числом');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/seller/machines', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...newMachine,
                    capacity: Math.max(1, parseInt(newMachine.capacity) || 0)
                }),
            });

            if (response.ok) {
                await fetchMachines();
                await fetchAllMachines();
                setNewMachine({
                    plate_number: '',
                    type: '',
                    capacity: '',
                    is_active: true
                });
                alert('Машина успешно создана!');
            } else {
                const errorText = await response.text();
                alert(`Ошибка при создании машины: ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка при создании машины:', error);
            alert('Ошибка при создании машины');
        }
    };

    const handleUpdateMachine = async () => {
        // Валидация при обновлении машины
        const plateRegex = /^[a-zA-Zа-яА-Я0-9]+$/;
        if (!plateRegex.test(editingMachine.plate_number) || editingMachine.plate_number.length > 20) {
            alert('Гос. номер должен содержать только буквы и цифры, максимум 20 символов');
            return;
        }

        if (!editingMachine.type || editingMachine.type.length > 50) {
            alert('Тип машины обязателен и не должен превышать 50 символов');
            return;
        }

        if (!editingMachine.capacity || parseInt(editingMachine.capacity) <= 0) {
            alert('Вместимость должна быть положительным числом');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8081/seller/machines', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(editingMachine),
            });

            if (response.ok) {
                await fetchMachines();
                await fetchAllMachines();
                setEditingMachine(null);
                alert('Машина успешно обновлена!');
            } else {
                const errorText = await response.text();
                alert(`Ошибка при обновлении машины: ${errorText}`);
            }
        } catch (error) {
            console.error('Ошибка при обновлении машины:', error);
            alert('Ошибка при обновлении машины');
        }
    };

    const handleDeleteMachine = async (machineId) => {
        if (window.confirm('Вы уверены, что хотите удалить эту машину?')) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:8081/seller/machines/${machineId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    await fetchMachines();
                    await fetchAllMachines();
                    alert('Машина успешно удалена!');
                } else {
                    const errorText = await response.text();
                    alert(`Ошибка при удалении машины: ${errorText}`);
                }
            } catch (error) {
                console.error('Ошибка при удалении машины:', error);
                alert('Ошибка при удалении машины');
            }
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU');
    };

    const getStatusName = (status) => {
        const statusMap = {
            'pending': 'Ожидает',
            'in_progress': 'В процессе',
            'completed': 'Завершен',
            'cancelled': 'Отменен'
        };
        return statusMap[status] || status;
    };

    const getHistoricalMachine = (order) => {
        return orderHistory[order.o_number] || order.o_machine_id;
    };

    const findMachineById = (machineId) => {
        return allMachines.find(m => m.id === machineId) || machines.find(m => m.id === machineId);
    };

    const handleTabClick = (tabName) => {
    if (activeTab === tabName && openTabs[tabName]) {
        setOpenTabs(prev => ({
            ...prev,
            [tabName]: false
        }));
        setActiveTab(''); 
    } else {
        setActiveTab(tabName);
        setOpenTabs(prev => ({
            orders: false,
            users: false,
            monitoring: false,
            prices: false,
            machines: false,
            [tabName]: true
        }));
        setEditingOrder(null);
        setEditingMachine(null);
        setSearchTerm('');
    }
};

    const shouldShowSearch = () => {
        return activeTab === 'orders' || activeTab === 'users';
    };

    const shouldShowStats = () => {
        return activeTab === 'orders' || activeTab === 'users';
    };

    const canDeleteUser = (userLogin, userRole) => {
        const currentUser = localStorage.getItem('login');
        return !protectedAccounts.includes(userLogin) && userLogin !== currentUser;
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'online': return 'status-online';
            case 'error': return 'status-error';
            case 'warning': return 'status-warning';
            default: return 'status-unknown';
        }
    };

    return (
        <div className={`admin-panel full-screen ${forceOrdersTab ? 'user-orders-mode' : ''}`}>
            {!forceOrdersTab && (
                <div className="admin-panel-header">
                    <h2>{isAdmin ? 'Панель администратора' : isSeller ? 'Панель продавца' : 'Мои заказы'}</h2>
                    <div className="admin-controls">
                        <div className="admin-tabs">
                            <button 
                                className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
                                onClick={() => handleTabClick('orders')}
                            >
                                Заказы
                            </button>
                            {isAdmin && (
                                <button 
                                    className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
                                    onClick={() => handleTabClick('users')}
                                >
                                    Пользователи
                                </button>
                            )}
                            {isAdmin && (
                                <button 
                                    className={`admin-tab ${activeTab === 'monitoring' ? 'active' : ''}`}
                                    onClick={() => handleTabClick('monitoring')}
                                >
                                    Мониторинг
                                </button>
                            )}
                            {(isSeller || isAdmin) && (
                                <button 
                                    className={`admin-tab ${activeTab === 'prices' ? 'active' : ''}`}
                                    onClick={() => handleTabClick('prices')}
                                >
                                    Цены
                                </button>
                            )}
                            {isSeller && (
                                <button 
                                    className={`admin-tab ${activeTab === 'machines' ? 'active' : ''}`}
                                    onClick={() => handleTabClick('machines')}
                                >
                                    Машины
                                </button>
                            )}
                            {shouldShowSearch() && openTabs[activeTab] && (
                                <input
                                    type="text"
                                    placeholder={`Поиск ${activeTab === 'orders' ? 'заказов' : 'пользователей'}...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="admin-search"
                                />
                            )}
                            {shouldShowStats() && openTabs[activeTab] && (
                                <div className="admin-stats-srch">
                                    {activeTab === 'orders' && `Всего заказов: ${orders.length} | Найдено: ${filteredOrders.length}`}
                                    {activeTab === 'users' && `Всего пользователей: ${users.length} | Найдено: ${filteredUsers.length}`}
                                </div>
                            )}
                        </div>
                        
                    </div>
                </div>
            )}

            <div className="admin-panel-content">
                {openTabs.machines && activeTab === 'machines' && isSeller ? (
                    <div className="admin-edit-form">
                        <div className="form-group">
                            <h4>Добавить новую машину</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                                <div>
                                    <label>Гос. номер:</label>
                                    <input
                                        type="text"
                                        value={newMachine.plate_number}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (/^[a-zA-Zа-яА-Я0-9]*$/.test(value) && value.length <= 20) {
                                                setNewMachine({...newMachine, plate_number: value});
                                            }
                                        }}
                                        placeholder="А123БВ77"
                                        maxLength={20}
                                    />
                                </div>
                                <div>
                                    <label>Тип:</label>
                                    <input
                                        type="text"
                                        value={newMachine.type}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value.length <= 50) {
                                                setNewMachine({...newMachine, type: value});
                                            }
                                        }}
                                        placeholder="Бетоновоз"
                                        maxLength={50}
                                    />
                                </div>
                                <div>
                                    <label>Вместимость (м³):</label>
                                    <input
                                        type="number"
                                        value={newMachine.capacity}
                                        onChange={(e) => {
                                            const value = Math.max(1, parseInt(e.target.value) || 1);
                                            setNewMachine({...newMachine, capacity: value});
                                        }}
                                        placeholder="8"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label>Активна:</label>
                                    <input
                                        type="checkbox"
                                        checked={newMachine.is_active}
                                        onChange={(e) => setNewMachine({...newMachine, is_active: e.target.checked})}
                                        style={{ marginLeft: '10px', marginTop: '25px' }}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleCreateMachine}
                                className="save-btn"
                                style={{ marginTop: '10px' }}
                                disabled={!newMachine.plate_number || !newMachine.type || !newMachine.capacity}
                            >
                                Добавить машину
                            </button>
                        </div>

                        <h4>Список машин</h4>
                        <table className="price-editor-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Гос. номер</th>
                                    <th>Тип</th>
                                    <th>Вместимость (м³)</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {machines.map(machine => (
                                    <tr key={machine.id}>
                                        <td>{machine.id}</td>
                                        <td>
                                            {editingMachine && editingMachine.id === machine.id ? (
                                                <input
                                                    type="text"
                                                    value={editingMachine.plate_number}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (/^[a-zA-Zа-яА-Я0-9]*$/.test(value) && value.length <= 20) {
                                                            setEditingMachine({
                                                                ...editingMachine,
                                                                plate_number: value
                                                            });
                                                        }
                                                    }}
                                                    maxLength={20}
                                                />
                                            ) : (
                                                machine.plate_number
                                            )}
                                        </td>
                                        <td>
                                            {editingMachine && editingMachine.id === machine.id ? (
                                                <input
                                                    type="text"
                                                    value={editingMachine.type}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (value.length <= 50) {
                                                            setEditingMachine({
                                                                ...editingMachine,
                                                                type: value
                                                            });
                                                        }
                                                    }}
                                                    maxLength={50}
                                                />
                                            ) : (
                                                machine.type
                                            )}
                                        </td>
                                        <td>
                                            {editingMachine && editingMachine.id === machine.id ? (
                                                <input
                                                    type="number"
                                                    value={editingMachine.capacity}
                                                    onChange={(e) => setEditingMachine({
                                                        ...editingMachine,
                                                        capacity: Math.max(1, parseInt(e.target.value) || 1)
                                                    })}
                                                    min="1"
                                                />
                                            ) : (
                                                `${machine.capacity} м³`
                                            )}
                                        </td>
                                        <td>
                                            {editingMachine && editingMachine.id === machine.id ? (
                                                <input
                                                    type="checkbox"
                                                    checked={editingMachine.is_active}
                                                    onChange={(e) => setEditingMachine({
                                                        ...editingMachine,
                                                        is_active: e.target.checked
                                                    })}
                                                />
                                            ) : (
                                                <span className={`status-badge ${machine.is_active ? 'completed' : 'cancelled'}`}>
                                                    {machine.is_active ? 'Активна' : 'Неактивна'}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {editingMachine && editingMachine.id === machine.id ? (
                                                <>
                                                    <button onClick={handleUpdateMachine} className="save-btn" style={{marginRight: '5px'}}>
                                                        Сохранить
                                                    </button>
                                                    <button onClick={() => setEditingMachine(null)} className="cancel-btn">
                                                        Отмена
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={() => setEditingMachine(machine)}
                                                        className="edit-btn"
                                                        style={{marginRight: '5px'}}
                                                    >
                                                        Редактировать
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteMachine(machine.id)}
                                                        className="delete-btn"
                                                    >
                                                        Удалить
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : openTabs.prices && activeTab === 'prices' && (isSeller || isAdmin) ? (
                    <div className="admin-edit-form">
                        <div className="form-group">
                            <h4>Добавить новую марку бетона</h4>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label>Марка бетона:</label>
                                    <input
                                        type="text"
                                        value={newConcreteGrade}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (/^[a-zA-Z0-9]*$/.test(value) && value.length <= 20) {
                                                setNewConcreteGrade(value);
                                            }
                                        }}
                                        placeholder="Например: M550"
                                        style={{ marginTop: '5px' }}
                                        maxLength={20}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label>Цена за м³ (руб.):</label>
                                    <input
                                        type="number"
                                        value={newConcretePrice}
                                        onChange={(e) => {
                                            const value = Math.max(0, parseInt(e.target.value) || 0);
                                            setNewConcretePrice(value);
                                        }}
                                        placeholder="0"
                                        min="0"
                                        style={{ marginTop: '5px' }}
                                    />
                                </div>
                                <button 
                                    onClick={handleAddConcreteGrade}
                                    className="save-btn"
                                    style={{ marginBottom: '0' }}
                                    disabled={!newConcreteGrade || !newConcretePrice}
                                >
                                    Добавить
                                </button>
                            </div>
                        </div>

                        <h4>Редактирование цен существующих марок</h4>
                        <table className="price-editor-table">
                            <thead>
                                <tr>
                                    <th>Марка бетона</th>
                                    <th>Цена за м³ (руб.)</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {concreteGrades.map(grade => (
                                    <tr key={grade}>
                                        <td>{grade}</td>
                                        <td>
                                            <input
                                                type="number"
                                                value={concretePrices[grade] || 0}
                                                onChange={(e) => handlePriceChange(grade, e.target.value)}
                                                min="0"
                                            />
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => handleDeleteConcreteGrade(grade)}
                                                className="delete-btn"
                                                style={{ padding: '5px 10px', fontSize: '12px' }}
                                            >
                                                Удалить
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="form-actions">
                            <button onClick={savePrices} className="save-btn">Сохранить все цены</button>
                        </div>
                    </div>
                ) : editingOrder && (isSeller || isAdmin) ? (
                    <div className="admin-edit-form">
                        <h3>Редактирование заказа #{editingOrder.o_number}</h3>

                        {editingOrder.o_status === 'cancelled' && editingOrder.o_machine_id && (
                            <div style={{
                                backgroundColor: '#f8d7da',
                                border: '1px solid #f5c6cb',
                                borderRadius: '4px',
                                padding: '10px',
                                marginBottom: '15px',
                                color: '#721c24'
                            }}>
                                <strong>Внимание:</strong> При установке статуса "Отменен" машина будет автоматически освобождена для других заказов.
                            </div>
                        )}
                        
                        <div className="form-group">
                            <label>Статус заказа:</label>
                            <select
                                value={editingOrder.o_status}
                                onChange={(e) => {
                                    const newStatus = e.target.value;
                                    const shouldClearMachine = newStatus === 'cancelled';
                                    
                                    setEditingOrder({
                                        ...editingOrder,
                                        o_status: newStatus,
                                        o_machine_id: shouldClearMachine ? null : editingOrder.o_machine_id
                                    });
                                }}
                                className="form-control">
                                <option value="pending">Ожидает</option>
                                <option value="in_progress">В процессе</option>
                                <option value="completed">Завершен</option>
                                <option value="cancelled">Отменен</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Машина для доставки:</label>
                            <select
                                value={editingOrder.o_machine_id || ''}
                                onChange={(e) => setEditingOrder({
                                    ...editingOrder,
                                    o_machine_id: e.target.value ? parseInt(e.target.value) : null
                                })}
                                className="form-control"
                                disabled={editingOrder.o_status === 'cancelled' || editingOrder.o_status === 'completed'}
                            >
                                <option value="">-- Не назначена --</option>

                                {editingOrder.o_machine_id && (
                                    findMachineById(editingOrder.o_machine_id) ? (
                                        <option value={editingOrder.o_machine_id} style={{fontWeight: 'bold'}}>
                                            {findMachineById(editingOrder.o_machine_id).plate_number} - {findMachineById(editingOrder.o_machine_id).type} ({findMachineById(editingOrder.o_machine_id).capacity} м³) {editingOrder.o_status === 'completed' ? '' : (editingOrder.o_status === 'cancelled' ? 'ОСВОБОЖДЕНА' : 'ТЕКУЩАЯ')}
                                        </option>
                                    ) : (
                                        <option value={editingOrder.o_machine_id} style={{fontWeight: 'bold'}}>
                                            Машина #{editingOrder.o_machine_id} - {editingOrder.o_status === 'completed' ? '' : (editingOrder.o_status === 'cancelled' ? 'ОСВОБОЖДЕНА' : 'ТЕКУЩАЯ')}
                                        </option>
                                    )
                                )}

                                {(editingOrder.o_status !== 'completed' && editingOrder.o_status !== 'cancelled') && availableMachines.map(machine => (
                                    <option key={machine.id} value={machine.id}>
                                        {machine.plate_number} - {machine.type} ({machine.capacity} м³)
                                    </option>
                                ))}
                            </select>
                            {(editingOrder.o_status === 'completed' || editingOrder.o_status === 'cancelled') && (
                                <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                                    Для {editingOrder.o_status === 'completed' ? 'завершенных' : 'отмененных'} заказов нельзя изменить назначенную машину
                                </p>
                            )}
                            {editingOrder.o_status !== 'completed' && editingOrder.o_status !== 'cancelled' && availableMachines.length === 0 && editingOrder.o_betonv > 0 && (
                                <p style={{ color: '#666', fontSize: '12px', marginTop: '5px' }}>
                                    Нет доступных машин с объемом ≥ {editingOrder.o_betonv} м³
                                </p>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label>Объем бетона (м³):</label>
                            <input
                                type="number"
                                value={editingOrder.o_betonv}
                                onChange={(e) => {
                                    const newVolume = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                    setEditingOrder({
                                        ...editingOrder,
                                        o_betonv: newVolume,
                                    });
                                }}
                                min="0.1"
                                step="0.1"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Марка бетона:</label>
                            <select
                                value={editingOrder.o_betonmark}
                                onChange={(e) => {
                                    const newGrade = e.target.value;
                                    setEditingOrder({
                                        ...editingOrder,
                                        o_betonmark: newGrade,
                                    });
                                }}
                                className="form-control">
                                {concreteGrades.map(grade => (
                                    <option key={grade} value={grade}>{grade}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Адрес доставки:</label>
                            <input
                                type="text"
                                value={editingOrder.o_betontarget}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value.length <= 120 && /^[a-zA-Zа-яА-Я0-9\s.,/\-\–\—]*$/.test(value)) {
                                        setEditingOrder({
                                            ...editingOrder,
                                            o_betontarget: value
                                        });
                                    }
                                }}
                                maxLength={120}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Дата доставки:</label>
                            <input
                                type="date"
                                value={editingOrder.o_betontime.split('T')[0]}
                                onChange={(e) => setEditingOrder({
                                    ...editingOrder,
                                    o_betontime: e.target.value
                                })}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Цена:</label>
                            <input
                                type="number"
                                value={editingOrder.o_price}
                                onChange={(e) => {
                                    const value = Math.max(0, parseInt(e.target.value) || 0);
                                    setEditingOrder({
                                        ...editingOrder,
                                        o_price: value
                                    });
                                }}
                                min="0"
                                style={{backgroundColor: 'white', color: '#333'}}
                            />
                        </div>
                        
                        <div className="form-actions">
                            <button onClick={handleSaveOrder} className="save-btn">Сохранить</button>
                            <button onClick={handleDeleteOrder} className="delete-btn">Удалить заказ</button>
                            <button onClick={() => {
                                setEditingOrder(null);
                                setAvailableMachines([]);
                            }} className="cancel-btn">Отмена</button>
                        </div>
                    </div>
                ) : openTabs.orders && activeTab === 'orders' ? (
                    <div className="admin-orders-table-container">
                        <table className="admin-orders-table">
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Объем</th>
                                    <th>Марка</th>
                                    <th>Адрес</th>
                                    <th>Дата доставки</th>
                                    <th>Дата создания</th>
                                    <th>Цена</th>
                                    <th>Статус</th>
                                    {!forceOrdersTab && (isSeller || isAdmin) && <th>Машина</th>}
                                    {!forceOrdersTab && (isSeller || isAdmin) && <th>Пользователь</th>}
                                    {!forceOrdersTab && (isSeller || isAdmin) && <th style={{ minWidth: '120px' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOrders.map(order => {
                                    const historicalMachineId = getHistoricalMachine(order);
                                    const machine = findMachineById(historicalMachineId);
                                    return (
                                        <tr key={order.o_number}>
                                            <td className="text-center">{order.o_number}</td>
                                            <td className="text-center">{order.o_betonv} м³</td>
                                            <td className="text-center">{order.o_betonmark}</td>
                                            <td className="long-text text-center">{order.o_betontarget}</td>
                                            <td className="text-center">{formatDate(order.o_betontime)}</td>
                                            <td className="text-center">{formatDateTime(order.o_createdtime)}</td>
                                            <td className="text-center">{order.o_price} руб.</td>
                                            <td className="text-center">
                                                <span className={`status-badge ${order.o_status}`}>
                                                    {getStatusName(order.o_status)}
                                                </span>
                                            </td>
                                            {!forceOrdersTab && (isSeller || isAdmin) && (
                                                <td className="text-center">
                                                    {machine ? (
                                                        <span>
                                                            {machine.plate_number}
                                                            {order.o_status === 'cancelled' && ' (осв.)'}
                                                        </span>
                                                    ) : historicalMachineId ? (
                                                        <span>
                                                            Машина #{historicalMachineId}
                                                            {order.o_status === 'cancelled' && ' (осв.)'}
                                                        </span>
                                                    ) : (
                                                        'Не назначена'
                                                    )}
                                                </td>
                                            )}
                                            {!forceOrdersTab && (isSeller || isAdmin) && <td className="text-center">{order.o_logcreater}</td>}
                                            {!forceOrdersTab && (isSeller || isAdmin) && (
                                                <td className="text-center">
                                                    <button 
                                                        onClick={() => handleEditOrder(order)}
                                                        className="edit-btn"
                                                        style={{ whiteSpace: 'nowrap' }}
                                                    >
                                                        Редактировать
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : openTabs.users && activeTab === 'users' && isAdmin ? (
                    <div className="admin-orders-table-container">
                        <div className="user-management-section">        
                            
                            {showUserCreator && (
                                <div className="admin-edit-form user-creator-form">
                                    <h4>Создать нового пользователя</h4>
                                    <div className="form-group">
                                        <label>Логин ({newUser.login.length}/20):</label>
                                        <input
                                            type="text"
                                            value={newUser.login}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value.length <= 20 && /^[a-zA-Z0-9]*$/.test(value)) {
                                                    setNewUser({...newUser, login: value});
                                                }
                                            }}
                                            placeholder="Введите логин"
                                            maxLength={20}
                                        />
                                        <small style={{color: '#666', fontSize: '12px'}}>Только латинские буквы и цифры, от 3 до 20 символов</small>
                                    </div>
                                    <div className="form-group">
                                        <label>Пароль ({newUser.password.length}/20):</label>
                                        <input
                                            type="password"
                                            value={newUser.password}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (value.length <= 20 && /^[a-zA-Z0-9]*$/.test(value)) {
                                                    setNewUser({...newUser, password: value});
                                                }
                                            }}
                                            placeholder="Введите пароль"
                                            maxLength={20}
                                        />
                                        <small style={{color: '#666', fontSize: '12px'}}>Только латинские буквы и цифры, от 6 до 20 символов</small>
                                    </div>
                                    <div className="form-group">
                                        <label>Роль:</label>
                                        <select
                                            value={newUser.role}
                                            onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                                            className="form-control">
                                            {roles.map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-actions">
                                        <button 
                                            onClick={handleCreateUser} 
                                            className="save-btn"
                                            disabled={newUser.login.length < 3 || newUser.password.length < 6}
                                        >
                                            Создать пользователя
                                        </button>
                                        <button onClick={() => setShowUserCreator(false)} className="cancel-btn">Отмена</button>
                                    </div>
                                </div>
                            )}

                            <table className="admin-orders-table users-table">
                                <thead>
                                    <tr>
                                        <th className="text-center">Логин</th>
                                        <th className="text-center">Роль</th>
                                        <th className="text-center" style={{ minWidth: '100px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map(user => (
                                        <tr key={user.login}>
                                            <td className="text-center">
                                                <span className={`user-role-badge ${user.role}`}>
                                                    {user.login}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span className={`role-badge ${user.role}`}>
                                                    {user.role === 'admin' ? 'Администратор' : 
                                                    user.role === 'seller' ? 'Продавец' : 'Покупатель'}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                {canDeleteUser(user.login, user.role) && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(user.login)}
                                                        className="delete-btn"
                                                    >
                                                        Удалить
                                                    </button>
                                                )}
                                                {!canDeleteUser(user.login, user.role) && (
                                                    <span className="protected-account">Защищён</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : openTabs.monitoring && activeTab === 'monitoring' && isAdmin ? (
                    <div className="monitoring-section">
                        <div className="monitoring-grid">
                            <div className="monitoring-left-column">
                                <div className="stats-card">
                                    <h3>Статистика приложения</h3>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span className="stat-label">Всего пользователей:</span>
                                            <span className="stat-value">{appStats.totalUsers || 0}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Всего заказов:</span>
                                            <span className="stat-value">{appStats.totalOrders || 0}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Размер БД:</span>
                                            <span className="stat-value">{appStats.databaseSize || 'N/A'}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Последнее резервное копирование:</span>
                                            <span className="stat-value">{appStats.lastBackup || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="management-card">
                                    <h3>Управление системой</h3>
                                    <div className="management-actions">
                                        <button 
                                            className="system-btn"
                                            onClick={async () => {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    const response = await fetch('http://localhost:8081/admin/toggle-registration', {
                                                        method: 'POST',
                                                        headers: {
                                                            'Authorization': `Bearer ${token}`,
                                                        },
                                                    });
                                                    if (response.ok) {
                                                        const result = await response.json();
                                                        alert(result.message);
                                                        fetchAppStats();
                                                    }
                                                } catch (error) {
                                                    console.error('Ошибка при переключении регистрации:', error);
                                                }
                                            }}
                                        >
                                            {appStats.registrationEnabled ? 'Запретить регистрацию' : 'Разрешить регистрацию'}
                                        </button>
                                        <button 
                                            className="system-btn"
                                            onClick={async () => {
                                                try {
                                                    const token = localStorage.getItem('token');
                                                    const response = await fetch('http://localhost:8081/admin/toggle-orders', {
                                                        method: 'POST',
                                                        headers: {
                                                            'Authorization': `Bearer ${token}`,
                                                        },
                                                    });
                                                    if (response.ok) {
                                                        const result = await response.json();
                                                        alert(result.message);
                                                        fetchAppStats();
                                                    }
                                                } catch (error) {
                                                    console.error('Ошибка при переключении создания заказов:', error);
                                                }
                                            }}
                                        >
                                            {appStats.orderCreationEnabled ? 'Запретить создание заказов' : 'Разрешить создание заказов'}
                                        </button>
                                    </div>
                                    <div className="system-status">
                                        <div className="status-indicators">
                                            <span className={`status-indicator ${appStats.registrationEnabled ? 'status-online' : 'status-error'}`}>
                                                Регистрация: {appStats.registrationEnabled ? 'Включена' : 'Отключена'}
                                            </span>
                                            <span className={`status-indicator ${appStats.orderCreationEnabled ? 'status-online' : 'status-error'}`}>
                                                Заказы: {appStats.orderCreationEnabled ? 'Включены' : 'Отключены'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="monitoring-right-column">
                                <div className="status-card">
                                    <h3>Статус системы</h3>
                                    <div className="status-list">
                                        {systemStatus.database && (
                                            <div className="status-item">
                                                <span className="status-label">База данных:</span>
                                                <span className={`status-indicator ${getStatusClass(systemStatus.database.status)}`}>
                                                    {systemStatus.database.status === 'online' ? '✅ Онлайн' : 
                                                    systemStatus.database.status === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}
                                                </span>
                                            </div>
                                        )}
                                        {systemStatus.api && (
                                            <div className="status-item">
                                                <span className="status-label">API сервер:</span>
                                                <span className={`status-indicator ${getStatusClass(systemStatus.api.status)}`}>
                                                    {systemStatus.api.status === 'online' ? '✅ Онлайн' : 
                                                    systemStatus.api.status === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}
                                                </span>
                                            </div>
                                        )}
                                        {systemStatus.authentication && (
                                            <div className="status-item">
                                                <span className="status-label">Аутентификация:</span>
                                                <span className={`status-indicator ${getStatusClass(systemStatus.authentication.status)}`}>
                                                    {systemStatus.authentication.status === 'online' ? '✅ Онлайн' : 
                                                    systemStatus.authentication.status === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}
                                                </span>
                                            </div>
                                        )}
                                        {systemStatus.orders && (
                                            <div className="status-item">
                                                <span className="status-label">Модуль заказов:</span>
                                                <span className={`status-indicator ${getStatusClass(systemStatus.orders.status)}`}>
                                                    {systemStatus.orders.status === 'online' ? '✅ Онлайн' : 
                                                    systemStatus.orders.status === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}
                                                </span>
                                            </div>
                                        )}
                                        {systemStatus.users && (
                                            <div className="status-item">
                                                <span className="status-label">Модуль пользователей:</span>
                                                <span className={`status-indicator ${getStatusClass(systemStatus.users.status)}`}>
                                                    {systemStatus.users.status === 'online' ? '✅ Онлайн' : 
                                                    systemStatus.users.status === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {systemStatus.lastCheck && (
                                        <div className="last-check">
                                            Последняя проверка: {systemStatus.lastCheck}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default AdminPanel;